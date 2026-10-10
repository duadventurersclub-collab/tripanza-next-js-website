import { cache } from "react";
import { unstable_cache } from "next/cache";
import { wordpressOrigin } from "./site-settings";
import { EMPTY_TOUR_SEO, normalizeTourSeo, type TourSeoConfig } from "./tour-seo-types";

const readTourSeo = unstable_cache(async (): Promise<TourSeoConfig> => {
  const response = await fetch(`${wordpressOrigin}/wp-json/tripanza-headless/v1/seo/public`, {
    cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) return EMPTY_TOUR_SEO; // Older WordPress plugin during rollout.
  if (!response.ok) throw new Error("Tour SEO settings are unavailable");
  return normalizeTourSeo(await response.json());
}, ["tour-seo-v1", wordpressOrigin], { revalidate: 60, tags: ["tour-seo"] });

export const getTourSeoConfig = cache(readTourSeo);
