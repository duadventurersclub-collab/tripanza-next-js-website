import { cache } from "react";
import { randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { getTourBySlug, transformStTour, type TourDetail } from "./st-tours";
import { getPublicSiteSettings } from "./public-site-settings";
import { getSiteSettings, wordpressOrigin } from "./site-settings";
import type { SiteConfig } from "./wp";

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

async function loadHomepage(featuredSlugs: string[]): Promise<{ site: SiteConfig; tours: HomeTour[] }> {
  const [listing, siteResult] = await Promise.all([
    wordpressJson("tours?per_page=24&admin_only=1"),
    wordpressJson("site").catch(() => fallbackSite),
  ]);
  const response = listing && typeof listing === "object" ? listing as { items?: unknown[]; admin_only?: boolean } : {};
  if (response.admin_only !== true || !Array.isArray(response.items)) throw new Error("The homepage tour listing is unavailable");
  const summaries = response.items.map(transformStTour);
  const [details, featured] = await Promise.all([
    Promise.allSettled(summaries.map(tour => getTourBySlug(tour.slug, true))),
    Promise.allSettled(featuredSlugs.map(slug => getTourBySlug(slug, true))),
  ]);
  const base = summaries.map((tour, index) => details[index].status === "fulfilled" && details[index].value ? details[index].value! : tour);
  const promoted = featured.flatMap(result => result.status === "fulfilled" && result.value ? [result.value] : []);
  const tours = [...promoted, ...base.filter(tour => !promoted.some(item => item.id === tour.id))];
  const seenReviews = new Set<string>();
  const reviews = tours.flatMap(tour => tour.details.reviews).filter(review => {
    const key = `${review.author_name}|${review.text}`;
    if (seenReviews.has(key)) return false;
    seenReviews.add(key);
    return true;
  }).slice(0, 8);
  return { site: siteResult as SiteConfig, tours: tours.map((tour, index) => homeTour(tour, index === 0 ? reviews : [])) };
}

export const getHomepageData = cache(async (live = false) => {
  const settings = await (live ? getSiteSettings() : getPublicSiteSettings());
  const featuredSlugs = settings.featured_tour_slugs.split(",").map(slug => slug.trim()).filter(Boolean).slice(0, 12);
  if (live) return loadHomepage(featuredSlugs);
  return unstable_cache(
    () => loadHomepage(featuredSlugs),
    ["homepage-v1", wordpressOrigin, settings.cache_revision, featuredSlugs.join(",")],
    { revalidate: Math.max(1, Math.min(settings.tour_cache_seconds, settings.site_cache_seconds)), tags: ["public-data", "tours", "site"] },
  )();
});
