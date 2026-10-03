import { cache } from "react";
import { randomUUID } from "node:crypto";
import { DEFAULT_SETTINGS, type SiteSettings } from "./site-settings-types";

export const wordpressOrigin = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");

export const LIVE_SETTINGS_HEADERS = { Accept: "application/json", "Cache-Control": "no-cache, no-store", Pragma: "no-cache" };

export function liveSettingsUrl(path: "settings/public" | "admin/settings" | "admin/cache") {
  const url = new URL(`${wordpressOrigin}/wp-json/tripanza-headless/v1/${path}`);
  // no-store only bypasses Next's cache, not an upstream CDN's existing entry.
  // A unique non-secret key avoids stale settings on Cloudflare/LiteSpeed.
  url.searchParams.set("_tripanza_live", randomUUID());
  return url.toString();
}

// Only request-local deduplication: a process cache could keep Host enabled after
// an administrator disables it. Neither config nor authorization is data-cached.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const response = await fetch(liveSettingsUrl("settings/public"), {
      cache: "no-store", headers: LIVE_SETTINGS_HEADERS, signal: AbortSignal.timeout(8000),
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
