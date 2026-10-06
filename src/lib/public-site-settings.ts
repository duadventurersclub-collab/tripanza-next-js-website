import { cache } from "react";
import { unstable_cache } from "next/cache";
import { fetchSiteSettings, wordpressOrigin } from "./site-settings";
import { DEFAULT_SETTINGS } from "./site-settings-types";

// Display configuration only. Authorization and booking APIs use getSiteSettings.
// Fetch a unique upstream URL on cache miss, so a stale CDN cannot repopulate it.
const readPublicSettings = unstable_cache(fetchSiteSettings, ["public-site-settings-v1", wordpressOrigin], {
  revalidate: 60,
  tags: ["site-controls"],
});

export const getPublicSiteSettings = cache(async () => {
  try { return await readPublicSettings(); }
  catch { return DEFAULT_SETTINGS; } // A failed fetch is never saved in the data cache.
});
