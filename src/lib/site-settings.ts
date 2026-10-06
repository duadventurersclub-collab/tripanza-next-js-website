import { cache } from "react";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { DEFAULT_SETTINGS, type SiteSettings } from "./site-settings-types";

export const wordpressOrigin = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");

export const LIVE_SETTINGS_HEADERS = { Accept: "application/json", "Cache-Control": "no-cache, no-store", Pragma: "no-cache" };

export function liveSettingsUrl(path: "settings/public" | "admin/settings" | "admin/cache" | "admin/operations") {
  const url = new URL(`${wordpressOrigin}/wp-json/tripanza-headless/v1/${path}`);
  // no-store only bypasses Next's cache, not an upstream CDN's existing entry.
  // A unique non-secret key avoids stale settings on Cloudflare/LiteSpeed.
  url.searchParams.set("_tripanza_live", randomUUID());
  return url.toString();
}

// Fresh reader for enforcement. Public rendering wraps this separately in a
// bounded cache; authorization and booking APIs continue to use live settings.
export async function fetchSiteSettings(): Promise<SiteSettings> {
  const response = await fetch(liveSettingsUrl("settings/public"), {
    cache: "no-store", headers: LIVE_SETTINGS_HEADERS, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Site settings are unavailable");
  const data = await response.json();
  if (typeof data.host_enabled !== "boolean" || typeof data.cache_revision !== "string") throw new Error("Invalid site settings");
  return { ...DEFAULT_SETTINGS, ...data };
}

export async function readLiveSiteSettings(): Promise<SiteSettings> {
  try {
    return await fetchSiteSettings();
  } catch { return DEFAULT_SETTINGS; }
}

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    // The proxy strips client-supplied values, then injects public settings only
    // for rendered pages. API requests have this header removed. Reuse that
    // request snapshot throughout the page instead of a second upstream fetch.
    const encoded = (await headers()).get("x-tripanza-render-settings");
    if (encoded) {
      const data = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      if (typeof data.host_enabled === "boolean" && typeof data.cache_revision === "string") return { ...DEFAULT_SETTINGS, ...data };
    }
  } catch { /* No render snapshot (e.g. request-independent tests). */ }
  return readLiveSiteSettings();
});

export async function publicCacheOptions(kind: "tour" | "availability" | "reel" | "host" | "site", tags: string[] = [], forceFresh = false): Promise<RequestInit> {
  const settings = await getSiteSettings();
  const seconds = settings[`${kind}_cache_seconds`];
  if (forceFresh || !settings.public_cache_enabled || seconds === 0) return { cache: "no-store" };
  const group = { tour: "tours", availability: "tours", reel: "meta-reels", host: "hosts", site: "site" }[kind];
  return { headers: { Accept: "application/json", "X-Tripanza-Cache-Revision": settings.cache_revision }, next: { revalidate: seconds, tags: [...new Set(["public-data", group, ...tags])] } };
}
