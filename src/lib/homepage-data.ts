import { cache } from "react";
import { randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { getTourBySlug, transformStTour, type TourDetail } from "./st-tours";
import { getPublicSiteSettings } from "./public-site-settings";
import { getSiteSettings, wordpressOrigin } from "./site-settings";
import type { SiteConfig } from "./wp";
import { normalizeHomepageSections, type HomepageSections, type HomepageCatalog, type HomepageSection } from "./homepage-sections";

export type HomeTour = Pick<TourDetail, "id" | "slug" | "title" | "featured_image" | "currency" | "price"> & {
  terms?: TourDetail["terms"];
  details: Pick<TourDetail["details"], "origin" | "destination" | "duration" | "pricing" | "departures" | "gallery" | "reels" | "rating" | "bulk_discounts" | "reviews" | "offer" | "partner" | "cashback" | "is_premium"> & {
    booking: Pick<TourDetail["details"]["booking"], "discount_rate" | "discount_type" | "deposit_percentage">;
    stays: Array<Pick<TourDetail["details"]["stays"][number], "title" | "location" | "type" | "amenities" | "images">>;
  };
};

const fallbackSite: SiteConfig = {
  name: "Tripanza", description: "India's coolest travel community", url: wordpressOrigin,
  admin_url: "", site_language: "en-IN", timezone: "Asia/Kolkata",
};

async function wordpressJson(path: string): Promise<unknown> {
  const url = new URL(`${wordpressOrigin}/wp-json/tripanza-headless/v1/${path}`);
  url.searchParams.set("_tripanza_live", randomUUID());
  const response = await fetch(url, {
    cache: "no-store", signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json", "Cache-Control": "no-cache, no-store" },
  });
  if (!response.ok) throw new Error(`WordPress ${response.status} for ${url.pathname}`);
  return response.json();
}

function homeTour(tour: TourDetail, reviews: TourDetail["details"]["reviews"]): HomeTour {
  const details = tour.details;
  return {
    id: tour.id, slug: tour.slug, title: tour.title, featured_image: tour.featured_image,
    currency: tour.currency, price: tour.price, terms: tour.terms,
    details: {
      origin: details.origin, destination: details.destination, duration: details.duration,
      pricing: details.pricing, departures: details.departures.slice(0, 3),
      gallery: details.gallery.slice(0, 2), reels: details.reels, rating: details.rating,
      bulk_discounts: [...details.bulk_discounts].sort((a, b) => a.from - b.from).slice(0, 1),
      reviews,
      stays: details.stays.slice(0, 5).map(stay => ({
        title: stay.title, location: stay.location, type: stay.type,
        amenities: stay.amenities.slice(0, 3), images: stay.images.slice(0, 1),
      })),
      booking: {
        discount_rate: details.booking.discount_rate, discount_type: details.booking.discount_type,
        deposit_percentage: details.booking.deposit_percentage,
      },
      offer: details.offer, partner: details.partner, cashback: details.cashback,
      is_premium: details.is_premium,
    },
  };
}

export function homeTourSummary(tour: TourDetail): HomeTour {
  return homeTour(tour, []);
}

async function cachedTour(slug: string, ttl: number): Promise<TourDetail> {
  const url = `${wordpressOrigin}/wp-json/tripanza-headless/v1/tours/${encodeURIComponent(slug)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: ttl, tags: ["public-data", "tours", `tour:${slug}`] },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`WordPress ${response.status} for ${slug}`);
  return transformStTour(await response.json());
}

async function loadHomepage(featuredSlugs: string[], sections: HomepageSections, ttl: number): Promise<{ site: SiteConfig; tours: HomeTour[]; automaticTourSlugs: string[]; categoryOrder: Partial<Record<HomepageSection, string[]>> }> {
  const categoryRules = Object.values(sections).filter(rule => rule.mode === "category");
  const [listing, siteResult, catalogResult] = await Promise.all([
    wordpressJson("tours?per_page=24&admin_only=1"),
    wordpressJson("site").catch(() => fallbackSite),
    categoryRules.length ? wordpressJson("homepage/catalog").catch(() => null) : Promise.resolve(null),
  ]);
  const response = listing && typeof listing === "object" ? listing as { items?: unknown[]; admin_only?: boolean } : {};
  if (response.admin_only !== true || !Array.isArray(response.items)) throw new Error("The homepage tour listing is unavailable");
  const summaries = response.items.map(transformStTour);
  const catalog = catalogResult as HomepageCatalog | null;
  const termsBySlug = new Map(catalog?.tours.map(tour => [tour.slug, tour.terms] as const) || []);
  const selectedSlugs = Object.values(sections).flatMap(rule => rule.mode === "manual" ? rule.slugs : []);
  const categoryOrder: Partial<Record<HomepageSection, string[]>> = {};
  for (const key of Object.keys(sections) as HomepageSection[]) {
    const rule = sections[key];
    if (rule.mode === "category") categoryOrder[key] = catalog?.tours.filter(tour =>
      tour.terms?.[rule.taxonomy]?.some(term => term.slug === rule.term),
    ).slice(0, 12).map(tour => tour.slug) || [];
  }
  const categorySlugs = Object.values(categoryOrder).flatMap(slugs => slugs || []);
  const extraSlugs = [...new Set([...selectedSlugs, ...categorySlugs])];
  // Preserve rich content for all cards, but only bypass WordPress's CDN for
  // the first eight and featured trips. The other details reuse Next's data
  // cache instead of flooding the WordPress origin on every ISR rebuild.
  const prioritySlugs = new Set([...featuredSlugs, ...summaries.slice(0, 8).map(tour => tour.slug)]);
  const detailSlugs = [...new Set([...featuredSlugs, ...summaries.map(tour => tour.slug), ...extraSlugs])];
  const detailResults = await Promise.allSettled(detailSlugs.map(slug =>
    ttl === 0 || prioritySlugs.has(slug) ? getTourBySlug(slug, true) : cachedTour(slug, ttl),
  ));
  const bySlug = new Map(detailSlugs.flatMap((slug, index) => {
    const result = detailResults[index];
    return result.status === "fulfilled" && result.value ? [[slug, result.value] as const] : [];
  }));
  const base = summaries.map(tour => {
    const detail = bySlug.get(tour.slug);
    return detail ? { ...detail, title: tour.title, featured_image: tour.featured_image, price: tour.price, currency: tour.currency } : tour;
  });
  const promoted = featuredSlugs.flatMap(slug => bySlug.has(slug) ? [bySlug.get(slug)!] : []);
  const automaticTours = [...promoted, ...base.filter(tour => !promoted.some(item => item.id === tour.id))];
  const known = new Set(automaticTours.map(tour => tour.id));
  const extras = extraSlugs.flatMap(slug => {
    const tour = bySlug.get(slug);
    if (!tour || known.has(tour.id)) return [];
    known.add(tour.id);
    return [tour];
  });
  const tours = [...automaticTours, ...extras];
  const seenReviews = new Set<string>();
  const reviews = tours.flatMap(tour => tour.details.reviews).filter(review => {
    const key = `${review.author_name}|${review.text}`;
    if (seenReviews.has(key)) return false;
    seenReviews.add(key);
    return true;
  }).slice(0, 8);
  return { site: siteResult as SiteConfig, automaticTourSlugs: automaticTours.map(tour => tour.slug), categoryOrder, tours: tours.map((tour, index) => ({
    ...homeTour(tour, index === 0 ? reviews : []), terms: termsBySlug.get(tour.slug) || tour.terms,
  })) };
}

export const getHomepageData = cache(async (live = false) => {
  const settings = await (live ? getSiteSettings() : getPublicSiteSettings());
  const featuredSlugs = settings.featured_tour_slugs.split(",").map(slug => slug.trim()).filter(Boolean).slice(0, 12);
  const sections = normalizeHomepageSections(settings.homepage_sections);
  if (live) return loadHomepage(featuredSlugs, sections, 0);
  const ttl = Math.max(1, Math.min(settings.tour_cache_seconds, settings.site_cache_seconds));
  return unstable_cache(
    () => loadHomepage(featuredSlugs, sections, ttl),
    ["homepage-v2", wordpressOrigin, settings.cache_revision, featuredSlugs.join(","), JSON.stringify(sections)],
    { revalidate: ttl, tags: ["public-data", "tours", "site", "homepage"] },
  )();
});
