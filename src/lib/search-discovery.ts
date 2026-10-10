import type { Metadata } from "next";
import { getPublicSiteSettings } from "./public-site-settings";
import type { SiteSettings } from "./site-settings-types";

// The WordPress setting is optional while the site uses its Vercel production domain.
// Never infer a canonical origin from the request host (which may be a preview URL).
export const DEFAULT_PUBLIC_SITE_ORIGIN = "https://tripanza-next-js-website.vercel.app";

export function publicOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim() || process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_PUBLIC_SITE_ORIGIN);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

export function publicUrl(origin: string, path: string): string {
  return new URL(path.replace(/^\/+/, ""), `${origin}/`).toString();
}

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export async function publicPageMetadata(path: string, title: string, description: string, image?: string, settings?: SiteSettings): Promise<Metadata> {
  const origin = publicOrigin((settings || await getPublicSiteSettings()).seo_site_url);
  const url = origin ? publicUrl(origin, path) : undefined;
  return {
    title: { absolute: title.includes("Tripanza") ? title : `${title} | Tripanza` },
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title, description, type: "website", siteName: "Tripanza", url, images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}
