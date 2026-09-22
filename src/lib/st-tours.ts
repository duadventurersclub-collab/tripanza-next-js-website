import { cache } from "react";

type UnknownRecord = Record<string, unknown>;

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
  benefit?: string | null;
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

export type TourFAQ = { question: string; answer: string };

export type TourInsight = { title: string; description: string };

export type TourBulkDiscount = {
  audience: "quad" | "triple";
  title: string;
  from: number;
  to: number;
  value: number;
  type: "amount" | "percent";
};

export type TourReview = {
  author_name: string;
  rating: number;
  text: string;
  date: string;
  profile_photo_url: string;
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

type TourPrice = { amount: number; display: string };

export type TourPricingMatrix = {
  currency: string;
  quad: TourPrice | null;
  triple: TourPrice | null;
  twin: TourPrice | null;
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
    journey_insights: TourInsight[];
    stays: TourAccommodation[];
    highlights: string[];
    included: string[];
    excluded: string[];
    faqs: TourFAQ[];
    bulk_discounts: TourBulkDiscount[];
    reviews: TourReview[];
    booking: {
      discount_rate: number;
      discount_type: "amount" | "percent";
      deposit_percentage: number;
    };
    partner: TourPartner;
    seats_left?: string;
    cashback?: string;
    is_premium?: boolean;
    is_trending?: boolean;
  };
  raw_meta?: UnknownRecord;
  terms?: Record<string, Array<{ id: number; name: string; slug: string }>>;
};

type TourListResponse = {
  items?: unknown[];
  tours?: unknown[];
  data?: unknown[];
  total?: number;
  total_pages?: number;
};

const WORDPRESS_URL = (
  process.env.WORDPRESS_URL ||
  process.env.NEXT_PUBLIC_WORDPRESS_URL ||
  "https://tripanza.com"
).replace(/\/$/, "");

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    hellip: "…",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code.toLowerCase()] ?? entity;
  });
}

export function plainText(value: unknown): string {
  const rendered = record(value).rendered;
  const source = rendered !== undefined ? rendered : value;
  if (source === undefined || source === null) return "";
  return decodeEntities(String(source))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === "string") return stringList(entry);
      const item = record(entry);
      const text = plainText(firstDefined(item.title, item.name, item.text, item.value, item.description));
      return text ? [text] : [];
    });
  }
  if (typeof value !== "string") return [];
  return plainText(value)
    .split(/\r?\n|\s*\|\s*/)
    .map((item) => item.replace(/^[-*•✓]\s*/, "").trim())
    .filter(Boolean);
}

function urlFrom(value: unknown): string {
  if (typeof value === "string") return /^https?:\/\//i.test(value.trim()) ? value.trim() : "";
  const item = record(value);
  const sizes = record(item.sizes);
  return plainText(firstDefined(item.source_url, item.url, item.full, item.large, sizes.full, sizes.large));
}

function mediaList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter((item) => /^https?:\/\//i.test(item));
  }
  if (!Array.isArray(value)) return [];
  return value.map(urlFrom).filter(Boolean);
}

function numberFrom(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null) return 0;
  const normalized = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return normalized ? Number(normalized[0]) : 0;
}

function booleanFrom(value: unknown): boolean {
  return value === true || value === 1 || ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function currencyDisplay(amount: number, currency: string): string {
  if (!amount) return "";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
}

function price(value: unknown, currency: string): TourPrice | null {
  const item = record(value);
  const amount = numberFrom(firstDefined(item.amount, item.value, value));
  if (amount <= 0) return null;
  return { amount, display: plainText(item.display) || currencyDisplay(amount, currency) };
}

function durationFrom(value: unknown): { days: string; nights: string } {
  const item = record(value);
  const structuredDuration = `${plainText(item.days)} ${plainText(item.nights)}`.trim();
  const structuredDays = structuredDuration.match(/(\d+)\s*(?:d|day)/i)?.[1];
  const structuredNights = structuredDuration.match(/(\d+)\s*(?:n|night)/i)?.[1];
  if (structuredDays || structuredNights) {
    const dayCount = Number(structuredDays || Number(structuredNights) + 1 || 0);
    const nightCount = Number(structuredNights || Math.max(0, dayCount - 1));
    return { days: String(dayCount), nights: String(nightCount) };
  }
  const suppliedDays = numberFrom(item.days);
  const suppliedNights = numberFrom(item.nights);
  if (suppliedDays || suppliedNights) {
    return {
      days: String(suppliedDays || suppliedNights + 1),
      nights: String(suppliedNights || Math.max(0, suppliedDays - 1)),
    };
  }
  const raw = plainText(value);
  const days = raw.match(/(\d+)\s*(?:d|day)/i)?.[1];
  const nights = raw.match(/(\d+)\s*(?:n|night)/i)?.[1];
  if (days || nights) {
    const dayCount = Number(days || Number(nights) + 1 || 0);
    const nightCount = Number(nights || Math.max(0, dayCount - 1));
    return { days: String(dayCount), nights: String(nightCount) };
  }
  const numeric = numberFrom(value);
  return numeric > 0
    ? { days: String(numeric), nights: String(Math.max(0, numeric - 1)) }
    : { days: "", nights: "" };
}

function timestamp(value: unknown): number {
  const numeric = numberFrom(value);
  if (numeric > 1_000_000_000) return numeric > 10_000_000_000 ? Math.floor(numeric / 1000) : numeric;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  return 0;
}

function dateLabel(value: unknown): string {
  if (value === undefined || value === null || value === "" || value === 0) return "";
  const seconds = timestamp(value);
  if (!seconds) return plainText(value);
  return new Date(seconds * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function embeddedFeaturedImage(source: UnknownRecord): string {
  const embedded = record(source._embedded);
  const media = Array.isArray(embedded["wp:featuredmedia"]) ? embedded["wp:featuredmedia"] : [];
  return urlFrom(media[0]);
}

function embeddedTerms(source: UnknownRecord) {
  const embedded = record(source._embedded);
  const groups = Array.isArray(embedded["wp:term"]) ? embedded["wp:term"] : [];
  const terms: Record<string, Array<{ id: number; name: string; slug: string }>> = {};
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const value of group) {
      const term = record(value);
      const taxonomy = plainText(term.taxonomy) || "terms";
      const name = plainText(term.name);
      if (!name) continue;
      (terms[taxonomy] ??= []).push({
        id: numberFrom(term.id),
        name,
        slug: plainText(term.slug),
      });
    }
  }
  return terms;
}

function itineraryFrom(value: unknown, images: string[]): TourItineraryDay[] {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries.flatMap((entry, index) => {
    if (typeof entry === "string") {
      const description = plainText(entry);
      return description ? [{ day: index + 1, title: `Day ${index + 1}`, description, image_url: images[index % Math.max(images.length, 1)] || "" }] : [];
    }
    const item = record(entry);
    const title = plainText(firstDefined(item.title, item.name, item.heading, item.program_title));
    const description = plainText(firstDefined(item.desc, item.description, item.content, item.program_desc));
    if (!title && !description) return [];
    return [{
      day: numberFrom(firstDefined(item.day, item.day_number)) || index + 1,
      title: title || `Day ${index + 1}`,
      description,
      image_url: urlFrom(firstDefined(item.image_url, item.image, item.thumbnail)) || images[index % Math.max(images.length, 1)] || "",
    }];
  });
}

function staysFrom(value: unknown, fallbackImages: string[]): TourAccommodation[] {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries.flatMap((entry) => {
    const item = record(entry);
    const title = plainText(firstDefined(item.title, item.name, item.hotel_name));
    if (!title && typeof entry !== "string") return [];
    const images = mediaList(firstDefined(item.images, item.gallery, item.image));
    return [{
      title: title || plainText(entry),
      description: plainText(firstDefined(item.desc, item.description, item.content)),
      location: plainText(item.location),
      type: plainText(firstDefined(item.type, item.accommodation_type)),
      amenities: stringList(item.amenities),
      images: images.length ? images : fallbackImages.slice(0, 3),
    }];
  });
}

function faqsFrom(value: unknown): TourFAQ[] {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries.flatMap((entry) => {
    const item = record(entry);
    const question = plainText(firstDefined(item.question, item.title, item.name));
    const answer = plainText(firstDefined(item.answer, item.desc, item.description, item.content));
    return question && answer ? [{ question, answer }] : [];
  });
}

function insightsFrom(value: unknown): TourInsight[] {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries.flatMap((entry) => {
    const item = record(entry);
    const title = plainText(firstDefined(item.title, item.name));
    const description = plainText(firstDefined(item.description, item.desc, item.content));
    return title || description ? [{ title: title || "Why this experience works", description }] : [];
  });
}

function bulkDiscountsFrom(value: unknown): TourBulkDiscount[] {
  const entries = Array.isArray(value) ? value : [];
  return entries.flatMap((entry) => {
    const item = record(entry);
    const from = numberFrom(firstDefined(item.from, item.key));
    const valueAmount = numberFrom(item.value);
    if (!from || !valueAmount) return [];
    const audience = plainText(item.audience) === "triple" ? "triple" : "quad";
    return [{
      audience,
      title: plainText(item.title) || "Group saving",
      from,
      to: numberFrom(firstDefined(item.to, item.key_to)) || from,
      value: valueAmount,
      type: plainText(item.type) === "percent" ? "percent" : "amount",
    }];
  });
}

function reviewsFrom(value: unknown): TourReview[] {
  const entries = Array.isArray(value) ? value : [];
  return entries.slice(0, 10).flatMap((entry) => {
    const item = record(entry);
    const author = plainText(firstDefined(item.author_name, item.author, item.name));
    const text = plainText(firstDefined(item.text, item.review, item.content));
    if (!author || !text) return [];
    return [{
      author_name: author,
      rating: Math.max(0, Math.min(5, numberFrom(item.rating) || 5)),
      text,
      date: plainText(firstDefined(item.date, item.review_date)),
      profile_photo_url: urlFrom(firstDefined(item.profile_photo_url, item.photo, item.avatar)),
    }];
  });
}

function departuresFrom(value: unknown) {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries.flatMap((entry) => {
    const item = record(entry);
    const date = firstDefined(item.date, item.check_in, item.start_date, entry);
    const label = dateLabel(date);
    if (!label) return [];
    return [{
      date: label,
      check_out: dateLabel(firstDefined(item.check_out, item.end_date)),
      status: plainText(item.status) || "Available",
      promoted: booleanFrom(item.promoted),
      badge: plainText(item.badge) || null,
      benefit: plainText(item.benefit) || null,
    }];
  });
}

function unwrapTour(payload: unknown): unknown {
  const wrapper = record(payload);
  return firstDefined(wrapper.item, wrapper.tour, wrapper.data, payload);
}

export function transformStTour(sourceValue: unknown): TourDetail {
  const source = record(unwrapTour(sourceValue));
  const meta = record(source.meta);
  const acf = record(source.acf);
  const suppliedDetails = record(source.details);
  const fields = { ...meta, ...acf, ...suppliedDetails, ...source };
  const id = numberFrom(source.id);
  const slug = plainText(source.slug) || String(id);
  const title = plainText(source.title) || "Untitled tour";
  const terms = embeddedTerms(source);

  const rawGallery = firstDefined(fields.gallery_urls, fields.gallery, fields.st_gallery, fields._st_tour_gallery, fields.images);
  const galleryUrls = mediaList(rawGallery);
  const featuredImage = urlFrom(firstDefined(
    fields.featured_image,
    fields.featured_image_url,
    fields.thumbnail,
    fields.image,
  )) || embeddedFeaturedImage(source) || galleryUrls[0] || "";
  const allImages = Array.from(new Set([featuredImage, ...galleryUrls].filter(Boolean)));
  const gallery = allImages.map((url) => ({ url, alt: title }));

  const currency = plainText(firstDefined(fields.currency, fields.currency_code)) || "INR";
  const explicitPricing = record(fields.pricing);
  const quad = price(firstDefined(explicitPricing.quad, fields.quad_price, fields.price_quad, fields._quad_price), currency);
  const triple = price(firstDefined(explicitPricing.triple, fields.triple_price, fields.price_triple, fields._triple_price), currency);
  const twin = price(firstDefined(explicitPricing.twin, fields.twin_price, fields.price_twin, fields._twin_price), currency);
  const basePrice = price(firstDefined(
    explicitPricing.starting_price,
    fields.sale_price,
    fields.price,
    fields.st_price,
    fields.min_price,
    fields.adult_price,
  ), currency);
  const startingPrice = basePrice?.display || quad?.display || triple?.display || twin?.display || "";

  const destinationTerms = Object.entries(terms)
    .filter(([taxonomy]) => /location|destination|region/i.test(taxonomy))
    .flatMap(([, values]) => values.map((term) => term.name));
  const destination = plainText(firstDefined(fields.destination, fields._st_tour_destination, fields.location_name, destinationTerms[0]));
  const origin = plainText(firstDefined(fields.origin, fields.start_location, fields.departure_location));
  const duration = durationFrom(firstDefined(fields.duration, fields.duration_day, fields.st_duration, fields._st_tour_duration));
  const reels = mediaList(firstDefined(fields.reels, fields.tour_reel_videos, fields.st_tour_reel_videos, fields.video_gallery));
  const videoUrl = urlFrom(firstDefined(fields.video_url, fields.video, reels[0]));

  const itinerary = itineraryFrom(firstDefined(fields.itinerary, fields.tours_program, fields.program), allImages);
  const stays = staysFrom(firstDefined(fields.stays, fields.accommodations, fields._st_tours_accommodation), allImages);
  const departures = departuresFrom(firstDefined(fields.departures, fields.availability, fields.tour_dates, fields._st_tour_dates));

  return {
    id,
    slug,
    title,
    excerpt: plainText(source.excerpt),
    content: plainText(source.content),
    featured_image: featuredImage || null,
    price: startingPrice,
    currency,
    link: `/tours/${slug}`,
    details: {
      origin,
      destination,
      address: plainText(firstDefined(fields.address, fields.location_address)),
      duration,
      capacity: numberFrom(firstDefined(fields.capacity, fields.max_people, fields.max_guests)),
      video_url: videoUrl,
      gallery,
      reels: Array.from(new Set([videoUrl, ...reels].filter(Boolean))),
      rating: {
        value: numberFrom(firstDefined(record(fields.rating).value, fields.rating, fields._st_tour_rating, fields.average_rating)),
        count: numberFrom(firstDefined(record(fields.rating).count, fields.review_count, fields._st_tour_reviews, fields.comment_count)),
      },
      pricing: {
        currency,
        quad,
        triple,
        twin,
        starting_price: startingPrice,
        as_of: plainText(explicitPricing.as_of),
      },
      departures,
      itinerary,
      journey_insights: insightsFrom(firstDefined(fields.journey_insights, fields.itinerary_insights, fields.supplemental_programs)),
      stays,
      highlights: stringList(firstDefined(fields.highlights, fields.tours_highlight)),
      included: stringList(firstDefined(fields.included, fields.tours_include, fields._tour_inclusions)),
      excluded: stringList(firstDefined(fields.excluded, fields.tours_exclude, fields._tour_exclusions)),
      faqs: faqsFrom(firstDefined(fields.faqs, fields.tours_faq, fields._st_tours_faq_repeater)),
      bulk_discounts: bulkDiscountsFrom(firstDefined(fields.bulk_discounts, fields.group_discounts)),
      reviews: reviewsFrom(firstDefined(fields.reviews, fields.google_reviews)),
      booking: {
        discount_rate: numberFrom(firstDefined(record(fields.booking).discount_rate, fields.discount_rate)),
        discount_type: plainText(firstDefined(record(fields.booking).discount_type, fields.discount_type)) === "percent" ? "percent" : "amount",
        deposit_percentage: Math.max(1, Math.min(100, numberFrom(firstDefined(record(fields.booking).deposit_percentage, fields.deposit_payment_amount)) || 100)),
      },
      partner: {
        name: plainText(firstDefined(record(fields.partner).name, fields.travel_company, fields.host_name)),
        logo_url: urlFrom(firstDefined(record(fields.partner).logo_url, fields.company_logo, fields.host_logo)),
        instagram_url: urlFrom(firstDefined(record(fields.partner).instagram_url, fields.instagram_profile)),
        verified: booleanFrom(firstDefined(record(fields.partner).verified, fields.partner_verified)),
        rating: numberFrom(firstDefined(record(fields.partner).rating, fields.partner_rating)),
        trip_count: numberFrom(firstDefined(record(fields.partner).trip_count, fields.total_trips)),
        profile_url: urlFrom(firstDefined(record(fields.partner).profile_url, fields.host_profile_url)) || plainText(fields.host_profile_url),
      },
      seats_left: plainText(firstDefined(fields.seats_left, fields.tripanza_seats_left)),
      cashback: plainText(firstDefined(fields.cashback, fields.tripanza_cashback_pp)),
      is_premium: booleanFrom(firstDefined(fields.is_premium, fields._is_premium_badge)),
      is_trending: booleanFrom(firstDefined(fields.is_trending, fields.tripanza_trending)),
    },
    raw_meta: { ...meta, ...acf },
    terms,
  };
}

async function request(path: string, revalidate = 300, tags: string[] = []): Promise<Response> {
  const url = `${WORDPRESS_URL}/${path.replace(/^\//, "")}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate, tags },
  });
  if (!response.ok) throw new Error(`WordPress ${response.status} for ${url}`);
  return response;
}

async function json(path: string, revalidate = 300, tags: string[] = []): Promise<unknown> {
  return (await request(path, revalidate, tags)).json();
}

function galleryMediaIds(value: unknown): number[] {
  const entries = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [value];
  return entries.flatMap((entry) => {
    if (typeof entry === "number" && entry > 0) return [entry];
    if (typeof entry === "string" && /^\d+$/.test(entry.trim())) return [Number(entry.trim())];
    const id = numberFrom(record(entry).id);
    return id > 0 && !urlFrom(entry) ? [id] : [];
  });
}

async function resolveGalleryMedia(values: unknown[]): Promise<unknown[]> {
  const idsByTour = values.map((value) => {
    const source = record(value);
    const fields = { ...record(source.meta), ...record(source.acf), ...record(source.details), ...source };
    return galleryMediaIds(firstDefined(fields.gallery, fields.st_gallery, fields._st_tour_gallery, fields.images));
  });
  const ids = Array.from(new Set(idsByTour.flat())).slice(0, 100);
  if (!ids.length) return values;

  try {
    const mediaPayload = await json(`wp-json/wp/v2/media?include=${ids.join(",")}&per_page=${ids.length}`, 300);
    if (!Array.isArray(mediaPayload)) return values;
    const mediaUrls = new Map(mediaPayload.map((item) => {
      const media = record(item);
      return [numberFrom(media.id), urlFrom(media)] as const;
    }));
    return values.map((value, index) => {
      const source = record(value);
      const resolved = idsByTour[index].map((id) => mediaUrls.get(id) || "").filter(Boolean);
      return resolved.length ? { ...source, gallery_urls: resolved } : value;
    });
  } catch {
    return values;
  }
}

function listFrom(payload: unknown): { values: unknown[]; total: number } {
  if (Array.isArray(payload)) return { values: payload, total: payload.length };
  const wrapper = record(payload) as TourListResponse;
  const values = wrapper.items || wrapper.tours || wrapper.data || [];
  return { values, total: numberFrom(wrapper.total) || values.length };
}

export async function getAppTours(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  taxonomy?: string;
  term?: number;
}): Promise<{ items: TourDetail[]; total: number }> {
  const page = Math.max(1, params?.page || 1);
  const perPage = Math.min(100, Math.max(1, params?.per_page || 15));
  const query = new URLSearchParams({ page: String(page), per_page: String(perPage), _embed: "1" });
  if (params?.search) query.set("search", params.search);
  if (params?.taxonomy && params.term) query.set(params.taxonomy, String(params.term));

  // The custom endpoint is deliberately compact and is the preferred source
  // for listing cards. Native wp/v2 responses can include several MB of meta.
  try {
    query.delete("_embed");
    const result = listFrom(await json(`wp-json/tripanza-headless/v1/tours?${query}`, 300, ["tours"]));
    if (result.values.length) {
      return { items: result.values.map(transformStTour), total: result.total };
    }
  } catch {
    // Fall through to native WordPress for installations without the plugin.
  }

  try {
    query.set("_embed", "1");
    const response = await request(`wp-json/wp/v2/st_tours?${query}`, 300, ["tours"]);
    const payload: unknown = await response.json();
    const values = Array.isArray(payload) ? payload : [];
    const hydratedValues = await resolveGalleryMedia(values);
    return {
      items: hydratedValues.map(transformStTour),
      total: numberFrom(response.headers.get("x-wp-total")) || values.length,
    };
  } catch {
    return { items: [], total: 0 };
  }
}

export const getTourBySlug = cache(async (slug: string): Promise<TourDetail | null> => {
  const cleanSlug = slug.trim();
  if (!cleanSlug) return null;
  const encoded = encodeURIComponent(cleanSlug);
  const loaders = [
    async () => unwrapTour(await json(
      `wp-json/tripanza-headless/v1/tours/${encoded}`,
      300,
      ["tours", `tour:${cleanSlug}`],
    )),
    async () => {
      const payload = await json(
        `wp-json/wp/v2/st_tours?slug=${encoded}&_embed=1`,
        300,
        ["tours", `tour:${cleanSlug}`],
      );
      if (!Array.isArray(payload) || !payload[0]) return null;
      return (await resolveGalleryMedia([payload[0]]))[0];
    },
    async () => {
      const result = listFrom(await json(
        `wp-json/tripanza-headless/v1/tours?search=${encoded}&per_page=100`,
        300,
        ["tours", `tour:${cleanSlug}`],
      ));
      return result.values.find((value) => plainText(record(value).slug) === cleanSlug) || null;
    },
  ];

  for (const load of loaders) {
    try {
      const value = await load();
      if (value && Object.keys(record(value)).length) return transformStTour(value);
    } catch {
      // Try the next supported WordPress route.
    }
  }
  return null;
});

export const getTourById = cache(async (id: number): Promise<TourDetail | null> => {
  if (!Number.isFinite(id) || id <= 0) return null;
  const result = await getAppTours({ per_page: 100 });
  const summary = result.items.find((tour) => tour.id === id);
  if (summary) return getTourBySlug(summary.slug);

  try {
    const source = await json(`wp-json/wp/v2/st_tours/${id}?_embed=1`, 300, ["tours"]);
    return transformStTour((await resolveGalleryMedia([source]))[0]);
  } catch {
    return null;
  }
});

export async function getFeaturedTours(perPage = 6): Promise<{ items: TourSummary[]; total: number }> {
  const result = await getAppTours({ per_page: perPage });
  return {
    total: result.total,
    items: result.items.map((tour) => ({
      id: tour.id,
      slug: tour.slug,
      title: tour.title,
      excerpt: tour.excerpt,
      featured_image: tour.featured_image,
      price: tour.price,
      currency: tour.currency,
      link: tour.link,
      destination: tour.details.destination,
      duration: tour.details.duration.days ? `${tour.details.duration.days}D / ${tour.details.duration.nights}N` : "",
      origin: tour.details.origin,
      rating: tour.details.rating.value,
      cashback: tour.details.cashback,
      trending: tour.details.is_trending,
      seatsLeft: tour.details.seats_left,
    })),
  };
}

export async function getAppTourAvailability(tourId: number): Promise<TourAvailabilityBatch[]> {
  const endpoints = [
    `wp-json/tripanza-app/v1/tours/${tourId}/availability`,
    `wp-json/tripanza-headless/v1/tours/${tourId}/availability`,
  ];
  for (const endpoint of endpoints) {
    try {
      const payload = await json(endpoint, 60);
      const values = Array.isArray(payload) ? payload : record(payload).items;
      if (!Array.isArray(values)) continue;
      return values.map((value) => {
        const item = record(value);
        const checkIn = timestamp(firstDefined(item.check_in_timestamp, item.check_in, item.date));
        const checkOut = timestamp(firstDefined(item.check_out_timestamp, item.check_out, item.end_date));
        return {
          check_in: checkIn,
          check_in_timestamp: checkIn,
          check_in_formatted: dateLabel(checkIn),
          check_out: checkOut,
          check_out_timestamp: checkOut,
          check_out_formatted: dateLabel(checkOut),
          adult_price: plainText(item.adult_price),
          child_price: plainText(item.child_price),
          infant_price: plainText(item.infant_price),
          status: plainText(item.status) || "Available",
          badge: plainText(item.badge),
          promoted: booleanFrom(item.promoted),
          benefit: plainText(item.benefit) || null,
        };
      });
    } catch {
      // Try the next availability route.
    }
  }
  return [];
}
