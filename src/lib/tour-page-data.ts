import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getTourBySlug } from "./st-tours";
import { wordpressOrigin } from "./site-settings";
import { getPublicSiteSettings } from "./public-site-settings";

export const getTourPageData = cache(async (slug: string) => {
  const settings = await getPublicSiteSettings();
  // Proxy selects the uncached renderer when public caching is disabled. Keep
  // this route consistently static even while the settings snapshot changes.
  const seconds = Math.max(1, settings.tour_cache_seconds);
  return unstable_cache(
    () => getTourBySlug(slug, true),
    ["tour-page-v1", wordpressOrigin, settings.cache_revision, slug],
    { revalidate: seconds, tags: ["public-data", "tours", `tour:${slug}`] },
  )();
});
