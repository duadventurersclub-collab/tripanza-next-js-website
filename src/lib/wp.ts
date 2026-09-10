export type SiteConfig = {
  name: string;
  description: string;
  url: string;
  admin_url: string;
  site_language: string;
  timezone: string;
};

export type TourSummary = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  featured_image: string | null;
  price: string;
  currency: string;
  link: string;
  destination?: string;
  duration?: string;
  origin?: string;
  rating?: number;
  cashback?: string;
  trending?: boolean;
  seatsLeft?: string;
};

export type TourAvailabilityBatch = {
  check_in: number;
  check_in_timestamp?: number;
  check_in_formatted?: string;
  check_out: number;
  check_out_timestamp?: number;
  check_out_formatted?: string;
  adult_price: string;
  child_price: string;
  infant_price: string;
  status: string;
  badge?: string;
  promoted?: boolean;
};

export type TourAccommodation = {
  title: string;
  description: string;
  location?: string;
  type?: string;
  amenities: string[];
  images: string[];
};

export type TourItineraryDay = {
  day: number;
  title: string;
  description: string;
  image_url: string;
};

export type TourFAQ = {
  question: string;
  answer: string;
};

export type TourPartner = {
  name: string;
  logo_url: string;
  instagram_url: string;
  verified: boolean;
  rating: number;
  trip_count: number;
  profile_url?: string;
};

export type TourPricingMatrix = {
  currency: string;
  quad: { amount: number; display: string } | null;
  triple: { amount: number; display: string } | null;
  twin: { amount: number; display: string } | null;
  starting_price?: string;
  as_of?: string;
};

export type TourDetail = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  featured_image: string | null;
  price: string;
  currency: string;
  link: string;
  details: {
    origin: string;
    destination: string;
    address?: string;
    duration: { days: string; nights: string };
    capacity: number;
    video_url: string;
    gallery: { url: string; alt: string }[];
    reels: string[];
    rating: { value: number; count: number };
    pricing: TourPricingMatrix;
    departures: Array<{
      date: string;
      check_out: string;
      status: string;
      promoted: boolean;
      badge: string | null;
      benefit: string | null;
    }>;
    itinerary: TourItineraryDay[];
    stays: TourAccommodation[];
    highlights: string[];
    included: string[];
    excluded: string[];
    faqs: TourFAQ[];
    partner: TourPartner;
    seats_left?: string;
    cashback?: string;
    is_premium?: boolean;
    is_trending?: boolean;
  };
  raw_meta?: Record<string, unknown>;
  terms?: Record<string, Array<{ id: number; name: string; slug: string }>>;
};

const WORDPRESS_URL = (process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    if ("rendered" in (value as Record<string, unknown>)) {
      return String((value as { rendered?: unknown }).rendered || "").trim();
    }
  }
  return String(value).trim();
}

export function parseMultilineOrArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((s) => s.trim().replace(/^[-*•]\s*/, ""))
      .filter((s) => s.length > 0 && !s.startsWith("http"));
  }
  return [];
}

export async function wpFetch<T>(path: string, revalidate = 300): Promise<T> {
  const url = `${WORDPRESS_URL}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    next: { revalidate },
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`WordPress request failed: ${res.status} ${res.statusText} at ${url}`);
  }

  return res.json() as Promise<T>;
}

// Convert any WordPress tour payload (wp/v2/st_tours or tripanza-app/v1/tours) into unified TourDetail
export function transformAppTourToDetail(item: any): TourDetail {
  const raw = item || {};
  // Merge root properties and nested meta so both shapes are covered
  const meta: Record<string, any> = { ...(raw.meta || {}), ...raw };

  const rawTitle = normalizeText(raw.title);
  const title = rawTitle || "Tripanza Himalayan Journey";

  const origin = normalizeText(meta.origin || meta.address || meta.st_location) || "Delhi / Chandigarh";
  const destination = normalizeText(meta.destination || meta._st_tour_destination) || "Himalayas";

  // Gallery
  const rawGallery = Array.isArray(meta.gallery)
    ? meta.gallery
    : typeof meta.gallery === "string" && meta.gallery.includes("http")
    ? meta.gallery.split(",").map((s: string) => s.trim())
    : [];

  const galleryItems = rawGallery
    .filter((img: any) => typeof img === "string" && img.startsWith("http"))
    .map((img: string) => ({ url: img, alt: title }));

  const featuredImgUrl =
    normalizeText(raw.featured_image_url?.large || raw.featured_image_url?.full || raw.featured_image?.large || raw.featured_image?.full) ||
    (galleryItems[0] ? galleryItems[0].url : "https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?q=80&w=1200");

  if (galleryItems.length === 0 && featuredImgUrl) {
    galleryItems.push({ url: featuredImgUrl, alt: title });
  }

  // Video reels
  const rawReels = meta.tour_reel_videos || meta.st_tour_reel_videos || [];
  const reels = Array.isArray(rawReels) ? rawReels.filter((r) => typeof r === "string" && r.length > 0) : [];

  // Duration
  const durationStr = normalizeText(meta.duration_day || meta.st_duration || meta.duration) || "4N/5D";
  let daysNum = 5;
  let nightsNum = 4;
  const matchDays = durationStr.match(/(\d+)\s*[dD]/);
  const matchNights = durationStr.match(/(\d+)\s*[nN]/);
  if (matchDays) daysNum = parseInt(matchDays[1], 10);
  if (matchNights) nightsNum = parseInt(matchNights[1], 10);

  // Highlights, Inclusions, Exclusions
  const highlights = parseMultilineOrArray(meta.tours_highlight);
  const included = parseMultilineOrArray(meta.tours_include || meta._tour_inclusions);
  const excluded = parseMultilineOrArray(meta.tours_exclude);

  // Itinerary (tours_program)
  const itinerary: TourItineraryDay[] = [];
  const rawProgram = meta.tours_program;
  if (rawProgram) {
    const list = Array.isArray(rawProgram) ? rawProgram : [rawProgram];
    list.forEach((entry: any, index: number) => {
      if (typeof entry === "string") {
        itinerary.push({
          day: index + 1,
          title: `Day ${index + 1}`,
          description: entry,
          image_url: galleryItems[index % galleryItems.length]?.url || featuredImgUrl,
        });
      } else if (typeof entry === "object" && entry !== null) {
        itinerary.push({
          day: Number(entry.day) || index + 1,
          title: normalizeText(entry.title) || `Day ${index + 1}`,
          description: normalizeText(entry.desc || entry.description),
          image_url: normalizeText(entry.image || entry.image_url) || galleryItems[index % galleryItems.length]?.url || featuredImgUrl,
        });
      }
    });
  }

  // If itinerary only has 1 day or is empty, extract from highlights if they contain "DAY X"
  if (itinerary.length < 2 && highlights.length > 0) {
    const dayHighlights = highlights.filter((h) => /^DAY\s*\d+/i.test(h));
    if (dayHighlights.length > 0) {
      dayHighlights.forEach((h, idx) => {
        const parts = h.split(/[-–:]/);
        const dayTitle = parts.length > 1 ? parts.slice(1).join("-").trim() : h;
        itinerary.push({
          day: idx + 1,
          title: `Day ${idx + 1}: ${dayTitle}`,
          description: `Experience the breathtaking beauty and planned group activities for ${dayTitle}. Guided by your dedicated Tripanza trip captains.`,
          image_url: galleryItems[idx % galleryItems.length]?.url || featuredImgUrl,
        });
      });
    }
  }

  // Stays / Accommodations
  const stays: TourAccommodation[] = [];
  const rawStays = meta._st_tours_accommodation;
  if (rawStays) {
    const list = Array.isArray(rawStays) ? rawStays : [rawStays];
    list.forEach((stay: any) => {
      if (typeof stay === "object" && stay !== null) {
        stays.push({
          title: normalizeText(stay.title) || "Cozy Mountain Resort & Stays",
          description: normalizeText(stay.desc || stay.description) || "Clean, comfortable rooms with heating, hot water, and scenic mountain balconies.",
          location: normalizeText(stay.location) || destination,
          type: normalizeText(stay.type) || "Hotel / Swiss Camp",
          amenities: Array.isArray(stay.amenities)
            ? stay.amenities
            : stay.amenities
            ? String(stay.amenities).split(",").map((s: string) => s.trim())
            : ["WiFi", "Meals", "Hot Showers", "Bonfire Night"],
          images: galleryItems.slice(0, 3).map((g) => g.url),
        });
      }
    });
  }

  // FAQs
  const faqs: TourFAQ[] = [];
  const rawFaqs = meta.tours_faq || meta._st_tours_faq_repeater;
  if (rawFaqs) {
    const list = Array.isArray(rawFaqs) ? rawFaqs : [rawFaqs];
    list.forEach((faq: any) => {
      if (typeof faq === "object" && faq !== null) {
        const question = normalizeText(faq.title || faq.question);
        const answer = normalizeText(faq.desc || faq.answer);
        if (question && answer) {
          faqs.push({ question, answer });
        }
      }
    });
  }

  // Price Parsing
  const parseNum = (str?: any): number => {
    if (!str) return 0;
    const clean = String(str).replace(/[^0-9]/g, "");
    return clean ? parseInt(clean, 10) : 0;
  };

  const quadNum = parseNum(meta.adult_price || meta.sale_price || meta.price || meta.st_price) || 16000;
  const tripleNum = parseNum(meta.child_price) || quadNum + 1000;
  const twinNum = parseNum(meta.infant_price) || quadNum + 2000;

  const bestPrice = `₹${quadNum.toLocaleString("en-IN")}`;

  // Departures
  const departures = [
    { date: normalizeText(meta._st_tour_dates) || "Every Friday Evening", check_out: "Following Week", status: "Filling Fast", promoted: true, badge: "Popular", benefit: "Weekend Departure" },
    { date: "Next Alternative Weekend", check_out: "Following Week", status: "Available", promoted: false, badge: null, benefit: null },
  ];

  const excerptText = normalizeText(raw.excerpt) || `Join this curated ${durationStr} journey from ${origin} to ${destination} with Tripanza.`;

  return {
    id: Number(raw.id) || 1,
    slug: raw.slug || "tour",
    title,
    excerpt: excerptText,
    content: normalizeText(raw.content) || "",
    featured_image: featuredImgUrl,
    price: bestPrice,
    currency: "INR",
    link: `/tours/${raw.slug}`,
    details: {
      origin,
      destination,
      address: normalizeText(meta.address),
      duration: { days: String(daysNum), nights: String(nightsNum) },
      capacity: parseInt(meta.max_people || "15", 10) || 15,
      video_url: reels[0] || "",
      gallery: galleryItems,
      reels,
      rating: {
        value: parseFloat(String(meta._st_tour_rating || "4.9")) || 4.9,
        count: parseInt(String(meta._st_tour_reviews || "140"), 10) || 140,
      },
      pricing: {
        currency: "INR",
        quad: { amount: quadNum, display: `₹${quadNum.toLocaleString("en-IN")}` },
        triple: { amount: tripleNum, display: `₹${tripleNum.toLocaleString("en-IN")}` },
        twin: { amount: twinNum, display: `₹${twinNum.toLocaleString("en-IN")}` },
        starting_price: bestPrice,
      },
      departures,
      itinerary: itinerary.length > 0 ? itinerary : [
        { day: 1, title: "Departure & Overnight Scenic Mountain Drive", description: "Assemble at the designated pick-up hub in Delhi/Chandigarh. Meet your Tripanza trip captain and fellow travelers. Kick off with music, icebreakers, and dinner pitstops.", image_url: featuredImgUrl },
        { day: 2, title: "Arrival, Mountain Check-in & Acclimatization", description: "Wake up to majestic Himalayan valley views. Check into cozy hotel, freshen up, and stroll through scenic local cafes and evening viewpoints.", image_url: featuredImgUrl },
        { day: 3, title: "High Altitude Passes & Monasteries", description: "Traverse high altitude mountain passes, explore sacred thousand-year-old monasteries, and click unforgettable group photographs.", image_url: featuredImgUrl },
        { day: 4, title: "Crystal Lakes, Bonfire & Return Journey", description: "Visit pristine alpine waters, capture breathtaking landscape memories, and commence the return drive with unforgettable friendships.", image_url: featuredImgUrl },
      ],
      stays: stays.length > 0 ? stays : [
        {
          title: "Boutique Mountain Hotels & Alpine Swiss Camps",
          description: "Carefully vetted properties with sanitised rooms, attached washrooms, continuous hot water, and delicious buffet meals.",
          location: destination,
          type: "Resort & Swiss Camps",
          amenities: ["WiFi", "Hot Showers", "Buffet Breakfast & Dinner", "Bonfire Setup"],
          images: galleryItems.slice(0, 3).map((g) => g.url),
        },
      ],
      highlights: highlights.length > 0 ? highlights : [
        "Traverse high mountain passes & breathtaking vistas",
        "Dedicated Tripanza Trip Captain & certified mountain driver",
        "Safe group travel tailored for solo, friends & couples",
        "Acoustic bonfire nights and engaging social vibes",
        "Delicious buffet breakfast and dinners included",
      ],
      included: included.length > 0 ? included : [
        "All transfers in sanitized AC Tempo Traveller / Volvo",
        "Accommodation on sharing basis as per selection",
        "Breakfast and dinner throughout the stay",
        "Dedicated Trip Captain & on-ground assistance",
        "All inner line permits, toll taxes, and driver allowances",
      ],
      excluded: excluded.length > 0 ? excluded : [
        "Lunches and personal cafe expenses",
        "Adventure activities like paragliding, rafting tickets",
        "Personal travel insurance",
      ],
      faqs: faqs.length > 0 ? faqs : [
        { question: "Can I join this trip as a solo traveller?", answer: "Yes, absolutely! More than 60% of Tripanza travellers join solo. We pair same-gender roommates so you feel completely comfortable and make lifelong friends." },
        { question: "What is the booking advance deposit amount?", answer: "You only need to pay a small token deposit of ₹2,000 per person to confirm your seat. The balance amount can be cleared before departure." },
        { question: "How safe is this trip for female solo travellers?", answer: "Safety is our highest priority. All our trips have verified trip leaders, vetted vendor properties, and dedicated 24/7 support." },
      ],
      partner: {
        name: normalizeText(meta.travel_company) || "Tripanza Mountain Expeditions",
        logo_url: normalizeText(meta.company_logo || meta.host_logo) || featuredImgUrl,
        instagram_url: normalizeText(meta.instagram_profile) || "https://instagram.com/tripanza",
        verified: true,
        rating: parseFloat(String(meta.partner_rating || "4.9")) || 4.9,
        trip_count: Number(meta.total_trips || 24),
        profile_url: normalizeText(meta.host_profile_url) || "/host/",
      },
      seats_left: normalizeText(meta.tripanza_seats_left) || "4 seats left",
      cashback: normalizeText(meta.tripanza_cashback_pp) ? `₹${meta.tripanza_cashback_pp} Cashback` : "₹500 Cashback",
      is_premium: meta._is_premium_badge === "1" || meta._is_premium_badge === "yes",
      is_trending: meta.tripanza_trending === "1" || meta.tripanza_trending === "yes" || true,
    },
    raw_meta: meta,
  };
}

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    return await wpFetch<SiteConfig>("wp-json/tripanza-headless/v1/site", 3600);
  } catch {
    return {
      name: "Tripanza",
      description: "India's coolest travel community",
      url: "https://tripanza.com",
      admin_url: "https://tripanza.com/wp-admin",
      site_language: "en-IN",
      timezone: "Asia/Kolkata",
    };
  }
}

export async function getAppTours(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  taxonomy?: string;
  term?: number;
}): Promise<{ items: TourDetail[]; total: number }> {
  const page = params?.page || 1;
  const perPage = params?.per_page || 15;
  const search = params?.search ? encodeURIComponent(params.search) : "";

  // 1. Try core WordPress route wp-json/wp/v2/st_tours (most complete & reliable)
  try {
    const coreUrl = `wp-json/wp/v2/st_tours?per_page=${perPage}&page=${page}${search ? `&search=${search}` : ""}`;
    const rawList = await wpFetch<any[]>(coreUrl, 60);
    if (Array.isArray(rawList) && rawList.length > 0) {
      const shaped = rawList.map(transformAppTourToDetail);
      return { items: shaped, total: shaped.length };
    }
  } catch {
    // continue
  }

  // 2. Try tripanza-app/v1/tours
  try {
    const rawTours = await wpFetch<any[]>(`wp-json/tripanza-app/v1/tours?page=${page}&per_page=${perPage}${search ? `&search=${search}` : ""}`, 60);
    if (Array.isArray(rawTours) && rawTours.length > 0) {
      const shaped = rawTours.map(transformAppTourToDetail);
      return { items: shaped, total: shaped.length };
    }
  } catch {
    // continue
  }

  return { items: [], total: 0 };
}

export async function getFeaturedTours(perPage = 6): Promise<{ items: TourSummary[]; total: number }> {
  const result = await getAppTours({ per_page: perPage });
  const summaries: TourSummary[] = result.items.map((tour) => ({
    id: tour.id,
    slug: tour.slug,
    title: tour.title,
    excerpt: tour.excerpt,
    featured_image: tour.featured_image,
    price: tour.price,
    currency: tour.currency,
    link: tour.link,
    destination: tour.details.destination,
    duration: `${tour.details.duration.days}D / ${tour.details.duration.nights}N`,
    origin: tour.details.origin,
    rating: tour.details.rating.value,
    cashback: tour.details.cashback,
    trending: tour.details.is_trending,
    seatsLeft: tour.details.seats_left,
  }));
  return { items: summaries, total: result.total };
}

export async function getTourById(id: number): Promise<TourDetail | null> {
  try {
    const rawTour = await wpFetch<any>(`wp-json/wp/v2/st_tours/${id}?_embed=1`);
    if (!rawTour) return null;
    return transformAppTourToDetail(rawTour);
  } catch (err) {
    console.error(`Error fetching tour by ID ${id}:`, err);
    return null;
  }
}

export async function getTourBySlug(slug: string): Promise<TourDetail | null> {
  const cleanSlug = encodeURIComponent(slug.trim());

  // 1. Primary: Query the native WordPress CPT route
  try {
    const rawTours = await wpFetch<any[]>(`wp-json/wp/v2/st_tours?slug=${cleanSlug}&_embed=1`);
    if (!rawTours || rawTours.length === 0) return null;
    return transformAppTourToDetail(rawTours[0]);
  } catch (err) {
    console.error("Error fetching tour by slug:", err);
    return null;
  }

  // 2. Secondary: Query tripanza-app/v1/tours?search=...
  try {
    const rawTours = await wpFetch<any[]>(`wp-json/tripanza-app/v1/tours?search=${cleanSlug}`, 0);
    if (Array.isArray(rawTours) && rawTours.length > 0) {
      const exact = rawTours.find((t: any) => t.slug === slug);
      if (exact) {
        return transformAppTourToDetail(exact);
      }
    }
  } catch {
    // continue
  }

  // 3. Tertiary: Tripanza headless endpoint
  try {
    const headlessTour = await wpFetch<any>(`wp-json/tripanza-headless/v1/tours/${cleanSlug}`, 0);
    if (headlessTour && headlessTour.id) {
      return transformAppTourToDetail(headlessTour);
    }
  } catch {
    // continue
  }

  return null;
}

export async function getAppTourAvailability(tourId: number): Promise<TourAvailabilityBatch[]> {
  try {
    const batches = await wpFetch<TourAvailabilityBatch[]>(`wp-json/tripanza-app/v1/tours/${tourId}/availability`, 60);
    if (Array.isArray(batches) && batches.length > 0) {
      return batches.map((b) => {
        const checkInDate = b.check_in ? new Date(b.check_in * 1000) : null;
        const checkOutDate = b.check_out ? new Date(b.check_out * 1000) : null;
        return {
          ...b,
          check_in_formatted: checkInDate ? checkInDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" }) : "Upcoming",
          check_out_formatted: checkOutDate ? checkOutDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" }) : "",
        };
      });
    }
  } catch {
    // fallback
  }

  return [];
}
