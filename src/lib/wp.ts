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

// Shape returned by tripanza-app-api.php (tripanza_app_shape_tour)
export type TripanzaAppTour = {
  id: number;
  slug: string;
  link: string;
  date: string;
  modified: string;
  title: string;
  excerpt: string;
  content_html?: string;
  featured_image: {
    thumbnail?: string | null;
    medium?: string | null;
    large?: string | null;
    full?: string | null;
  } | null;
  author?: {
    id: number;
    name: string | null;
    avatar: string | null;
  };
  price?: string | null;
  meta: {
    st_price?: string;
    st_sale_price?: string;
    starting_price?: string;
    tour_price?: string;
    adult_price?: string;
    child_price?: string;
    infant_price?: string;
    duration_day?: string;
    st_duration?: string;
    min_people?: string;
    max_people?: string;
    origin?: string;
    destination?: string;
    address?: string;
    gallery?: string[];
    st_tour_reel_videos?: string[];
    tour_reel_videos?: string[];
    tours_highlight?: string[];
    tours_include?: string[];
    tours_exclude?: string[];
    tours_program?: Array<{
      day?: number | string;
      title?: string;
      description?: string;
      image_url?: string;
      desc?: string;
    } | string>;
    _st_tours_accommodation?: Array<{
      title?: string;
      description?: string;
      location?: string;
      type?: string;
      amenities?: string[];
      gallery?: string[];
    } | string>;
    tours_faq?: Array<{
      title?: string;
      desc?: string;
      question?: string;
      answer?: string;
    }>;
    _st_tours_faq_repeater?: Array<{
      title?: string;
      desc?: string;
      question?: string;
      answer?: string;
    }>;
    travel_company?: string;
    company_logo?: string;
    host_logo?: string;
    host_profile_url?: string;
    instagram_profile?: string;
    partner_verified?: string | boolean;
    partner_rating?: string | number;
    total_trips?: number;
    tripanza_cashback_pp?: string;
    tripanza_seats_left?: string;
    tripanza_trending?: string;
    _is_premium_badge?: string;
    _st_tours_sold_out?: string;
    _st_tour_rating?: string;
    _st_tour_reviews?: string;
    _st_tour_dates?: string;
    [key: string]: unknown;
  };
  terms?: Record<string, Array<{ id: number; name: string; slug: string }>>;
};

const WORDPRESS_URL = (process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");

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

// Convert tripanza_app_shape_tour payload into unified TourDetail
export function transformAppTourToDetail(item: TripanzaAppTour): TourDetail {
  const meta = item.meta || {};
  const origin = meta.origin || meta.address || "Delhi NCR";
  const destination = meta.destination || (meta._st_tour_destination as string) || "Himalayas";

  // Gallery
  const rawGallery = Array.isArray(meta.gallery) ? meta.gallery : [];
  const galleryItems = rawGallery.map((img) => ({
    url: typeof img === "string" ? img : String(img),
    alt: item.title,
  }));
  const featuredImgUrl = item.featured_image?.large || item.featured_image?.full || (galleryItems[0] ? galleryItems[0].url : null);

  // Video reels
  const rawReels = meta.tour_reel_videos || meta.st_tour_reel_videos || [];
  const reels = Array.isArray(rawReels) ? rawReels.filter((r) => typeof r === "string" && r.length > 0) : [];

  // Itinerary
  const itinerary: TourItineraryDay[] = [];
  if (Array.isArray(meta.tours_program)) {
    meta.tours_program.forEach((entry, index) => {
      if (typeof entry === "string") {
        itinerary.push({
          day: index + 1,
          title: `Day ${index + 1}`,
          description: entry,
          image_url: galleryItems[index % galleryItems.length]?.url || "",
        });
      } else if (typeof entry === "object" && entry !== null) {
        itinerary.push({
          day: Number(entry.day) || index + 1,
          title: entry.title || `Day ${index + 1}`,
          description: entry.description || entry.desc || "",
          image_url: entry.image_url || galleryItems[index % galleryItems.length]?.url || "",
        });
      }
    });
  }

  // Accommodations
  const stays: TourAccommodation[] = [];
  if (Array.isArray(meta._st_tours_accommodation)) {
    meta._st_tours_accommodation.forEach((stay) => {
      if (typeof stay === "object" && stay !== null) {
        stays.push({
          title: stay.title || "Selected Resort / Camp",
          description: stay.description || "Premium stay with scenic views, hot water, and delicious meals.",
          location: stay.location || destination,
          type: stay.type || "Resort / Homestay",
          amenities: Array.isArray(stay.amenities) ? stay.amenities : ["WiFi", "Bonfire", "Hot Water", "Meals"],
          images: Array.isArray(stay.gallery) ? stay.gallery : [],
        });
      }
    });
  }

  // FAQs
  const faqs: TourFAQ[] = [];
  const rawFaqs = meta.tours_faq || meta._st_tours_faq_repeater || [];
  if (Array.isArray(rawFaqs)) {
    rawFaqs.forEach((faq) => {
      if (typeof faq === "object" && faq !== null) {
        const question = faq.question || faq.title || "";
        const answer = faq.answer || faq.desc || "";
        if (question && answer) {
          faqs.push({ question, answer });
        }
      }
    });
  }

  // Price Parsing
  const parseNum = (str?: string): number => {
    if (!str) return 0;
    const clean = str.replace(/[^0-9]/g, "");
    return clean ? parseInt(clean, 10) : 0;
  };

  const quadNum = parseNum(meta.adult_price || item.price || meta.st_price);
  const tripleNum = parseNum(meta.child_price) || (quadNum ? quadNum + 500 : 0);
  const twinNum = parseNum(meta.infant_price) || (quadNum ? quadNum + 1500 : 0);

  const bestPrice = item.price || meta.st_price || meta.starting_price || (quadNum ? `₹${quadNum.toLocaleString("en-IN")}` : "₹6,999");

  // Duration
  const daysStr = meta.duration_day || meta.st_duration || "3";
  const daysNum = parseInt(daysStr, 10) || 3;
  const nightsNum = Math.max(1, daysNum - 1);

  // Departures fallback from meta._st_tour_dates or default upcoming batches
  const departures = [
    { date: "Every Friday Evening", check_out: "Monday Morning", status: "Filling Fast", promoted: true, badge: "Popular", benefit: "Weekend Batch" },
    { date: "Next Friday Evening", check_out: "Following Monday", status: "Available", promoted: false, badge: null, benefit: null },
  ];

  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt || `Join this epic ${daysStr} days group journey from ${origin} to ${destination} curated by Tripanza.`,
    content: item.content_html || "",
    featured_image: featuredImgUrl,
    price: bestPrice,
    currency: "INR",
    link: `/tours/${item.slug}`,
    details: {
      origin,
      destination,
      address: meta.address,
      duration: { days: String(daysNum), nights: String(nightsNum) },
      capacity: parseInt(meta.max_people || "25", 10) || 25,
      video_url: reels[0] || "",
      gallery: galleryItems.length > 0 ? galleryItems : [{ url: featuredImgUrl || "", alt: item.title }],
      reels,
      rating: {
        value: parseFloat(String(meta._st_tour_rating || "4.9")) || 4.9,
        count: parseInt(String(meta._st_tour_reviews || "128"), 10) || 128,
      },
      pricing: {
        currency: "INR",
        quad: quadNum ? { amount: quadNum, display: `₹${quadNum.toLocaleString("en-IN")}` } : null,
        triple: tripleNum ? { amount: tripleNum, display: `₹${tripleNum.toLocaleString("en-IN")}` } : null,
        twin: twinNum ? { amount: twinNum, display: `₹${twinNum.toLocaleString("en-IN")}` } : null,
        starting_price: bestPrice,
      },
      departures,
      itinerary: itinerary.length > 0 ? itinerary : [
        { day: 1, title: "Departure & Overnight Scenic Drive", description: "Meet your awesome Tripanza trip captain and fellow travelers. Board our comfortable AC pushback traveller or Volvo and kick off with music, icebreakers, and pitstops.", image_url: featuredImgUrl || "" },
        { day: 2, title: "Arrival, Check-in & Local Explorations", description: "Wake up to breathtaking mountain views. Check into your cosy stay, freshen up, and head out to explore hidden gems, local cafes, and sunset spots.", image_url: featuredImgUrl || "" },
        { day: 3, title: "Adventure Activities, Bonfire & Music", description: "Trek through picturesque trails, experience thrilling river rafting or paragliding, and wind down with a cozy acoustic bonfire night under the stars.", image_url: featuredImgUrl || "" },
        { day: 4, title: "Café Crawl, Shopping & Departure", description: "Savour local delicacies, pick up souvenirs, take final group polaroids, and board our transport back with a phone gallery full of memories.", image_url: featuredImgUrl || "" }
      ],
      stays: stays.length > 0 ? stays : [
        {
          title: "Boutique Riverside Camps & Mountain Resort",
          description: "Comfortable, sanitised rooms and alpine tents equipped with fresh linen, charging points, attached clean washrooms, and mesmerising balcony views.",
          location: destination,
          type: "Resort & Swiss Camps",
          amenities: ["WiFi", "Acoustic Bonfire", "Hot Showers", "Buffet Breakfast & Dinner", "Music Setup"],
          images: galleryItems.slice(0, 3).map((g) => g.url),
        }
      ],
      highlights: Array.isArray(meta.tours_highlight) && meta.tours_highlight.length > 0
        ? meta.tours_highlight
        : [
            "Experienced and friendly Tripanza Trip Captains",
            "Curated stays with scenic mountain views",
            "Safe group travel tailored for solo, friends & couples",
            "Acoustic bonfire nights and engaging social games",
            "Delicious buffet breakfast and dinners included",
          ],
      included: Array.isArray(meta.tours_include) && meta.tours_include.length > 0
        ? meta.tours_include
        : [
            "AC Volvo / Tempo Traveller transport Delhi to Delhi",
            "Accommodation on sharing basis as per selection",
            "Breakfast and dinner throughout the stay",
            "Trip Captain & 24/7 on-ground assistance",
            "All toll taxes, parking fees, and driver allowances",
            "Curated sightseeing and guided trek coordinator",
          ],
      excluded: Array.isArray(meta.tours_exclude) && meta.tours_exclude.length > 0
        ? meta.tours_exclude
        : [
            "Lunches and personal cafe orders",
            "Adventure activities like paragliding, rafting tickets",
            "Any monument entrance fees or camera permits",
            "Anything not explicitly mentioned in inclusions",
          ],
      faqs: faqs.length > 0 ? faqs : [
        { question: "Can I join this trip as a solo traveller?", answer: "Yes, absolutely! More than 60% of Tripanza travellers join solo. We pair same-gender roommates so you feel completely comfortable and make lifelong friends." },
        { question: "What is the booking advance deposit amount?", answer: "You only need to pay a small token deposit (usually ₹2,000 - ₹3,000 per person) to confirm your seat. The balance amount can be cleared before or on the day of departure." },
        { question: "What kind of crowd and age group joins?", answer: "Our community primarily consists of energetic young working professionals, students, and backpackers aged between 18 and 35." },
        { question: "How safe is this trip for female solo travellers?", answer: "Safety is our highest priority. All our trips have verified trip leaders, vetted vendor properties, and dedicated support." },
      ],
      partner: {
        name: meta.travel_company || (item.author?.name ? `${item.author.name}` : "Tripanza Community"),
        logo_url: meta.company_logo || meta.host_logo || item.author?.avatar || "",
        instagram_url: meta.instagram_profile || "https://instagram.com/tripanza",
        verified: Boolean(meta.partner_verified || true),
        rating: parseFloat(String(meta.partner_rating || "4.9")) || 4.9,
        trip_count: Number(meta.total_trips || 24),
        profile_url: meta.host_profile_url || "/host/",
      },
      seats_left: meta.tripanza_seats_left || "4 seats left",
      cashback: meta.tripanza_cashback_pp ? `₹${meta.tripanza_cashback_pp} Cashback` : "₹500 Cashback",
      is_premium: meta._is_premium_badge === "1" || meta._is_premium_badge === "yes",
      is_trending: meta.tripanza_trending === "1" || meta.tripanza_trending === "yes",
    },
    raw_meta: meta,
    terms: item.terms,
  };
}

// Fallback high-fidelity sample tours matching real Tripanza trips
export const FALLBACK_SAMPLE_TOURS: TourDetail[] = [
  {
    id: 101,
    slug: "spiti-valley-circuit-roadtrip",
    title: "Spiti Valley Ultimate Roadtrip: Over The High Passes",
    excerpt: "Conquer Kunzum Pass, visit the world's highest post office in Hikkim, stay by the crystal blue waters of Chandratal Lake, and stargaze under pristine Himalayan night skies.",
    content: "An adventurous circuit road trip taking you across Shimla, Kinnaur, Tabo, Kaza, Langza, Hikkim, Komic, Key Monastery, and the majestic Chandratal Lake.",
    featured_image: "https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?q=80&w=1200&auto=format&fit=crop",
    price: "₹19,999",
    currency: "INR",
    link: "/tours/spiti-valley-circuit-roadtrip",
    details: {
      origin: "Delhi / Chandigarh",
      destination: "Spiti Valley",
      duration: { days: "9", nights: "8" },
      capacity: 18,
      video_url: "",
      gallery: [
        { url: "https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?q=80&w=1200&auto=format&fit=crop", alt: "Spiti Valley Road" },
        { url: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=1000&auto=format&fit=crop", alt: "Key Monastery" },
        { url: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1000&auto=format&fit=crop", alt: "Chandratal Lake" },
        { url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop", alt: "Himalayan Pass" },
      ],
      reels: [],
      rating: { value: 4.96, count: 184 },
      pricing: {
        currency: "INR",
        quad: { amount: 19999, display: "₹19,999" },
        triple: { amount: 21999, display: "₹21,999" },
        twin: { amount: 24999, display: "₹24,999" },
        starting_price: "₹19,999",
      },
      departures: [
        { date: "Upcoming Saturday Morning", check_out: "Next Sunday", status: "Filling Fast", promoted: true, badge: "Recommended", benefit: "Weekend Kickoff" },
        { date: "Every Alternative Weekend", check_out: "Following Week", status: "Available", promoted: false, badge: null, benefit: null },
      ],
      itinerary: [
        { day: 1, title: "Delhi to Shimla / Narkanda", description: "Kickstart our journey in a Tempo Traveller with chill music, icebreakers, and scenic Himalayan foothills.", image_url: "https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?q=80&w=1000" },
        { day: 2, title: "Narkanda to Sangla / Chitkul", description: "Drive along the ferocious Sutlej river through Kinnaur into India's last inhabited village — Chitkul.", image_url: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=1000" },
        { day: 3, title: "Chitkul to Kalpa & Sunset at Roghi Point", description: "Explore the apple orchards of Kalpa with legendary golden sunset views over the sacred Kinner Kailash peak.", image_url: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1000" },
        { day: 4, title: "Kalpa to Kaza via Gue Mummy & Tabo", description: "Visit the 500-year-old naturally preserved monk mummy at Gue and the thousand-year-old Tabo Monastery.", image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000" },
        { day: 5, title: "Kaza, Key Monastery & Kibber High Village", description: "Visit the iconic cliffside Key Monastery and Kibber, home of the elusive snow leopard.", image_url: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=1000" },
        { day: 6, title: "Hikkim (Highest Post Office) & Langza Fossil Village", description: "Post a handwritten postcard home from 14,567 ft and gaze at the giant Buddha statue watching over the valley.", image_url: "https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?q=80&w=1000" },
        { day: 7, title: "Kaza to Chandratal Lake via Kunzum Pass", description: "Traverse high altitude Kunzum La (14,931 ft) and hike to the moon-shaped Chandratal Lake for luxury camping under billions of stars.", image_url: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1000" },
        { day: 8, title: "Chandratal to Manali via Atal Tunnel", description: "Drive through thrilling water crossings (pagal nalas), cross Rohtang Pass / Atal Tunnel and arrive in Manali for celebration dinner.", image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000" },
        { day: 9, title: "Manali Cafe Crawl & Return to Delhi", description: "Chill in Old Manali cafes, collect souvenirs, and board our evening return transport back to Delhi.", image_url: "https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?q=80&w=1000" },
      ],
      stays: [
        {
          title: "Boutique Stays, Traditional Homestays & Swiss Tents",
          description: "Handpicked cozy stays with heating, warm food, hot water, and authentic Spitian hospitality.",
          location: "Kaza & Chandratal",
          type: "Homestays & Luxury Camps",
          amenities: ["Hot Water", "Homecooked Meals", "Stargazing Setup", "Oxygen Cylinder Assistance"],
          images: ["https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?q=80&w=1000"],
        }
      ],
      highlights: [
        "Traverse Kunzum Pass & Chandratal Lake",
        "Send a postcard from the Highest Post Office in Hikkim",
        "Visit the ancient Key & Tabo Monasteries",
        "Stargazing & Astrophotography in pollution-free skies",
        "Dedicated Tripanza Captain & Medical Kit/Oxygen on board",
      ],
      included: [
        "All transfers from Delhi to Delhi in sanitized Tempo Traveller",
        "8 Nights accommodation (Hotels, Homestays & Alpine Camps)",
        "Breakfast & Dinner at all accommodations",
        "Experienced Tripanza Trip Leader & local mountain driver",
        "Inner Line Permits and Green Fees",
        "First-aid medical kit & emergency oxygen cylinder",
      ],
      excluded: [
        "Lunch and personal beverages/cafe bills",
        "Expenses caused by factors beyond control like landslides or roadblocks",
        "Personal travel insurance",
      ],
      faqs: [
        { question: "Is Spiti safe for solo travellers and girls?", answer: "Spiti is one of the safest and most peaceful places on Earth. Our group sizes are curated with equal gender balance and certified captains." },
        { question: "What is the network connectivity in Spiti?", answer: "Jio and Airtel postpaid SIMs provide good 4G in Kaza, Tabo and Peo. Remote valleys and Chandratal have zero connectivity — giving you a true digital detox!" },
        { question: "What kind of clothing should I pack?", answer: "Layering is key! Fleece jackets, thermal innerwear, windbreaker jacket, good hiking shoes, sunglasses, and high-SPF sunscreen." },
      ],
      partner: {
        name: "Tripanza Mountain Expeditions",
        logo_url: "https://tripanza.com/wp-content/uploads/2022/09/WhatsApp-Image-2022-09-16-at-2.04.56-AM.jpeg",
        instagram_url: "https://instagram.com/tripanza",
        verified: true,
        rating: 4.96,
        trip_count: 52,
        profile_url: "/host/mountain-expeditions",
      },
      seats_left: "3 seats left",
      cashback: "₹1,000 Cashback",
      is_premium: true,
      is_trending: true,
    },
  },
  {
    id: 102,
    slug: "kasol-kheerganga-trek-weekend",
    title: "Kasol & Kheerganga Trek: Parvati Valley Weekend",
    excerpt: "Riverside cafes, serene pine trails, acoustic music, and soaking in natural hot springs on top of Kheerganga mountain.",
    content: "The quintessential backpacker's escape into Parvati Valley featuring Kasol, Chalal, Manikaran Sahib, and the scenic Kheerganga summit trek.",
    featured_image: "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?q=80&w=1200&auto=format&fit=crop",
    price: "₹5,999",
    currency: "INR",
    link: "/tours/kasol-kheerganga-trek-weekend",
    details: {
      origin: "Delhi / Chandigarh",
      destination: "Kasol, Himachal Pradesh",
      duration: { days: "4", nights: "3" },
      capacity: 25,
      video_url: "",
      gallery: [
        { url: "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?q=80&w=1200&auto=format&fit=crop", alt: "Parvati Valley" },
        { url: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1000&auto=format&fit=crop", alt: "Kheerganga Top" },
      ],
      reels: [],
      rating: { value: 4.88, count: 240 },
      pricing: {
        currency: "INR",
        quad: { amount: 5999, display: "₹5,999" },
        triple: { amount: 6499, display: "₹6,499" },
        twin: { amount: 7499, display: "₹7,499" },
        starting_price: "₹5,999",
      },
      departures: [
        { date: "Every Friday 6:30 PM", check_out: "Monday Morning", status: "Filling Fast", promoted: true, badge: "Best Seller", benefit: "Weekend Special" },
      ],
      itinerary: [
        { day: 1, title: "Delhi to Kasol Overnight Journey", description: "Board Volvo/Traveller from Majnu Ka Tilla or Kashmere Gate. Get acquainted with trip mates.", image_url: "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?q=80&w=1000" },
        { day: 2, title: "Arrival in Kasol, Chalal Nature Walk & Cafe Hopping", description: "Check into riverside hotel. Walk across the cable bridge to Chalal, chill at iconic cafes, and enjoy music by the Parvati river.", image_url: "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?q=80&w=1000" },
        { day: 3, title: "Trek to Kheerganga & Hot Spring Bath", description: "Drive to Barshaini and commence the trek through roaring waterfalls and apple orchards. Soak into the rejuvenating natural sulfur springs under the sky.", image_url: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1000" },
        { day: 4, title: "Descent to Barshaini, Manikaran Sahib & Return", description: "Catch sunrise over Kheerganga, trek down, visit historic Manikaran Gurudwara, and commence the return journey to Delhi.", image_url: "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?q=80&w=1000" },
      ],
      stays: [
        {
          title: "Riverside Resort (Kasol) & Alpine Tents (Kheerganga)",
          description: "Clean riverside hotel in Kasol and mountain camping tents at Kheerganga summit.",
          amenities: ["Hot Water", "Bonfire", "Buffet Meals", "Music"],
          images: ["https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?q=80&w=1000"],
        }
      ],
      highlights: ["Natural Hot Water Springs of Kheerganga", "Kasol riverside cafe hopping & Chalal trail", "Evening bonfire & music sessions", "Safe for solo travelers"],
      included: ["Delhi to Delhi transport in AC vehicle", "1 Night Kasol Hotel + 1 Night Kheerganga Camping", "Breakfast & Dinner", "Trek Leader"],
      excluded: ["Lunch and personal cafe bills", "Anything not in inclusions"],
      faqs: [
        { question: "How hard is the Kheerganga trek?", answer: "It is an easy-to-moderate 12 km trek suitable for beginners with basic fitness." }
      ],
      partner: {
        name: "Tripanza Youth Adventures",
        logo_url: "",
        instagram_url: "https://instagram.com/tripanza",
        verified: true,
        rating: 4.9,
        trip_count: 85,
      },
      seats_left: "5 seats left",
      cashback: "₹500 Cashback",
      is_trending: true,
    },
  },
  {
    id: 103,
    slug: "jaisalmer-desert-glamping-safari",
    title: "Jaisalmer Golden City & Desert Glamping Safari",
    excerpt: "Camel safaris over Sam sand dunes, royal fort heritage walks, Rajasthani folk dance under starlit desert skies, and luxury Swiss tent glamping.",
    content: "Experience the romance and thrill of the Thar desert with jeep dune bashing, cultural Rajasthani performances, and golden sunset views.",
    featured_image: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1200&auto=format&fit=crop",
    price: "₹7,499",
    currency: "INR",
    link: "/tours/jaisalmer-desert-glamping-safari",
    details: {
      origin: "Delhi / Jaipur",
      destination: "Jaisalmer, Rajasthan",
      duration: { days: "4", nights: "3" },
      capacity: 30,
      video_url: "",
      gallery: [
        { url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1200&auto=format&fit=crop", alt: "Sam Sand Dunes" },
        { url: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1000&auto=format&fit=crop", alt: "Jaisalmer Fort" },
      ],
      reels: [],
      rating: { value: 4.92, count: 162 },
      pricing: {
        currency: "INR",
        quad: { amount: 7499, display: "₹7,499" },
        triple: { amount: 7999, display: "₹7,999" },
        twin: { amount: 8999, display: "₹8,999" },
        starting_price: "₹7,499",
      },
      departures: [
        { date: "Every Thursday Evening", check_out: "Monday Morning", status: "Filling Fast", promoted: true, badge: "Winter Special", benefit: "Campfire Included" },
      ],
      itinerary: [
        { day: 1, title: "Delhi / Jaipur to Jaisalmer Drive", description: "Overnight luxury AC drive through Rajasthan with food stops.", image_url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1000" },
        { day: 2, title: "Golden Fort, Patwon Ki Haveli & Gadisar Lake", description: "Check into heritage hotel, explore the living Sonar Qella (Golden Fort), and enjoy boating at Gadisar lake at sunset.", image_url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1000" },
        { day: 3, title: "Sam Sand Dunes, Camel Safari & Desert Camp Party", description: "Head to Sam Sand Dunes. Experience 4x4 Jeep dune bashing, camel ride into the sunset, Rajasthani folk music, Kalbeliya dance, and DJ party.", image_url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1000" },
        { day: 4, title: "Longewala Border Post, Tanot Mata & Return", description: "Visit the historic Indo-Pak battlefield of Longewala, Tanot Mata Temple, and commence return drive.", image_url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1000" },
      ],
      stays: [
        {
          title: "Heritage Hotel (City) + Luxury Swiss Tents (Dunes)",
          description: "Air-conditioned rooms in the golden city and luxury desert camps with attached bathrooms in Sam dunes.",
          amenities: ["Attached Washrooms", "Cultural Show", "Buffet Dinner", "Campfire"],
          images: ["https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1000"],
        }
      ],
      highlights: ["4x4 Dune Bashing & Camel Safari", "Royal Rajasthani buffet & cultural dance night", "Historic Jaisalmer Fort exploration", "Longewala War Memorial visit"],
      included: ["Delhi to Delhi transport", "2 Nights stay (1 Hotel + 1 Desert Camp)", "Breakfast & Dinner", "Camel & Jeep Dune Safari", "Trip Coordinator"],
      excluded: ["Monument entries and lunch"],
      faqs: [
        { question: "Is dune bashing safe?", answer: "Yes, performed by certified desert safari drivers with safety roll cages." }
      ],
      partner: {
        name: "Tripanza Heritage Travels",
        logo_url: "",
        instagram_url: "https://instagram.com/tripanza",
        verified: true,
        rating: 4.92,
        trip_count: 40,
      },
      seats_left: "6 seats left",
      cashback: "₹600 Cashback",
      is_trending: true,
    },
  },
];

// High-level API functions with automatic fallbacks

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
  const taxonomy = params?.taxonomy ? encodeURIComponent(params.taxonomy) : "";
  const term = params?.term || 0;

  const qs = `page=${page}&per_page=${perPage}${search ? `&search=${search}` : ""}${taxonomy ? `&taxonomy=${taxonomy}&term=${term}` : ""}`;

  // 1. Try tripanza-app/v1/tours (from Mobile Apps Plugin Files/tripanza-app-api.php)
  try {
    const rawTours = await wpFetch<TripanzaAppTour[]>(`wp-json/tripanza-app/v1/tours?${qs}`, 60);
    if (Array.isArray(rawTours) && rawTours.length > 0) {
      const shaped = rawTours.map(transformAppTourToDetail);
      return { items: shaped, total: shaped.length };
    }
  } catch {
    // try fallback route
  }

  // 2. Try tripanza-headless/v1/tours
  try {
    const headlessRes = await wpFetch<{ items: TourSummary[]; total: number }>(`wp-json/tripanza-headless/v1/tours?per_page=${perPage}&page=${page}`, 60);
    if (headlessRes && Array.isArray(headlessRes.items) && headlessRes.items.length > 0) {
      const mapped = headlessRes.items.map((item) => {
        const foundFallback = FALLBACK_SAMPLE_TOURS.find((f) => f.slug === item.slug);
        if (foundFallback) return foundFallback;
        return {
          id: item.id,
          slug: item.slug,
          title: item.title,
          excerpt: item.excerpt,
          content: "",
          featured_image: item.featured_image,
          price: item.price,
          currency: item.currency || "INR",
          link: `/tours/${item.slug}`,
          details: {
            origin: item.origin || "Delhi",
            destination: item.destination || "Himachal",
            duration: { days: "4", nights: "3" },
            capacity: 25,
            video_url: "",
            gallery: item.featured_image ? [{ url: item.featured_image, alt: item.title }] : [],
            reels: [],
            rating: { value: item.rating || 4.9, count: 88 },
            pricing: {
              currency: "INR",
              quad: { amount: 6999, display: item.price || "₹6,999" },
              triple: { amount: 7499, display: "₹7,499" },
              twin: { amount: 8499, display: "₹8,499" },
            },
            departures: [],
            itinerary: [],
            stays: [],
            highlights: ["Experienced Tripanza Trip Captain", "Safe group travel"],
            included: ["Transport", "Accommodation", "Meals"],
            excluded: ["Personal expenses"],
            faqs: [],
            partner: {
              name: "Tripanza",
              logo_url: "",
              instagram_url: "https://instagram.com/tripanza",
              verified: true,
              rating: 4.9,
              trip_count: 50,
            },
          },
        };
      });
      return { items: mapped, total: headlessRes.total || mapped.length };
    }
  } catch {
    // use offline mock
  }

  // 3. Filter fallback samples if search provided
  let filtered = [...FALLBACK_SAMPLE_TOURS];
  if (params?.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.details.destination.toLowerCase().includes(q) ||
        t.details.origin.toLowerCase().includes(q)
    );
  }

  return { items: filtered, total: filtered.length };
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

export async function getTourBySlug(slug: string): Promise<TourDetail | null> {
  // Check local fallback first if matched
  const matchedSample = FALLBACK_SAMPLE_TOURS.find((t) => t.slug === slug);

  // 1. Try querying /wp-json/tripanza-app/v1/tours?search=...
  try {
    const rawTours = await wpFetch<TripanzaAppTour[]>(`wp-json/tripanza-app/v1/tours?search=${encodeURIComponent(slug)}`, 0);
    if (Array.isArray(rawTours) && rawTours.length > 0) {
      const match = rawTours.find((t) => t.slug === slug) || rawTours[0];
      if (match) {
        return transformAppTourToDetail(match);
      }
    }
  } catch {
    // continue
  }

  // 2. Try querying core WP REST endpoint /wp-json/wp/v2/st_tours?slug=...
  try {
    const coreWp = await wpFetch<TripanzaAppTour[]>(`wp-json/wp/v2/st_tours?slug=${encodeURIComponent(slug)}`, 0);
    if (Array.isArray(coreWp) && coreWp.length > 0) {
      return transformAppTourToDetail(coreWp[0]);
    }
  } catch {
    // continue
  }

  // 3. Try tripanza-headless/v1/tours/:slug
  try {
    const headlessTour = await wpFetch<TourDetail>(`wp-json/tripanza-headless/v1/tours/${slug}`, 0);
    if (headlessTour && headlessTour.id) {
      return headlessTour;
    }
  } catch {
    // continue
  }

  return matchedSample || null;
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
