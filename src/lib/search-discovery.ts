import type { Metadata } from "next";
import { getSiteSettings } from "./site-settings";

export function publicOrigin(value: string): string | null {
  try {
    const url = new URL(value);
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

export async function publicPageMetadata(path: string, title: string, description: string, image?: string): Promise<Metadata> {
  const origin = publicOrigin((await getSiteSettings()).seo_site_url);
  const url = origin ? publicUrl(origin, path) : undefined;
  return {
    title: { absolute: title.includes("Tripanza") ? title : `${title} | Tripanza` },
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title, description, type: "website", siteName: "Tripanza", url, images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}
