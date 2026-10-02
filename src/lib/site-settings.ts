import { cache } from "react";
import { DEFAULT_SETTINGS, type SiteSettings } from "./site-settings-types";

export const wordpressOrigin = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");

// Only request-local deduplication: a process cache could keep Host enabled after
// an administrator disables it. Neither config nor authorization is data-cached.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const response = await fetch(`${wordpressOrigin}/wp-json/tripanza-headless/v1/settings/public`, {
      cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return DEFAULT_SETTINGS;
    const data = await response.json();
    if (typeof data.host_enabled !== "boolean" || typeof data.cache_revision !== "string") return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...data };
  } catch { return DEFAULT_SETTINGS; }
});

export async function publicCacheOptions(kind: "tour" | "availability" | "reel" | "host" | "site", tags: string[] = [], forceFresh = false): Promise<RequestInit> {
  const settings = await getSiteSettings();
  const seconds = settings[`${kind}_cache_seconds`];
  if (forceFresh || !settings.public_cache_enabled || seconds === 0) return { cache: "no-store" };
  const group = { tour: "tours", availability: "tours", reel: "meta-reels", host: "hosts", site: "site" }[kind];
  return { headers: { Accept: "application/json", "X-Tripanza-Cache-Revision": settings.cache_revision }, next: { revalidate: seconds, tags: [...new Set(["public-data", group, ...tags])] } };
}
