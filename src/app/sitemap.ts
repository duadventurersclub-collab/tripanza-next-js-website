import type { MetadataRoute } from "next";
import { getAppTours } from "@/lib/wp";
import { getSiteSettings } from "@/lib/site-settings";
import { publicOrigin, publicUrl } from "@/lib/search-discovery";
import { getPublicHostData, type HostSummary } from "@/lib/host";
import { getTourSeoConfig } from "@/lib/tour-seo";
import { EMPTY_TOUR_SEO } from "@/lib/tour-seo-types";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSiteSettings();
  const origin = publicOrigin(settings.seo_site_url);
  if (!origin) return [];
  const paths = ["/", "/about", "/contact", "/cancellation-policy", "/cookies-policy", "/disclaimer", "/privacy-policy", "/tnc"];
  if (settings.reels_enabled) paths.push("/trips");
  if (settings.host_enabled) paths.push("/host");
  const urls = paths.map(path => ({ url: publicUrl(origin, path) }));
  try {
    const seo = await getTourSeoConfig().catch(() => EMPTY_TOUR_SEO);
    const first = await getAppTours({ page: 1, per_page: 100 });
    const totalPages = Math.min(499, Math.ceil(first.total / 100));
    const pages: Awaited<ReturnType<typeof getAppTours>>[] = [];
    for (let page = 2; page <= totalPages; page += 8) {
      pages.push(...await Promise.all(Array.from({ length: Math.min(8, totalPages - page + 1) }, (_, index) => getAppTours({ page: page + index, per_page: 100 }))));
    }
    const seen = new Set<string>();
    for (const tour of [first, ...pages].flatMap(page => page.items)) {
      if (!tour.slug || seen.has(tour.slug) || seo.tours[String(tour.id)]?.noindex) continue;
      seen.add(tour.slug);
      urls.push({ url: publicUrl(origin, `/tours/${encodeURIComponent(tour.slug)}`) });
    }
  } catch { /* Keep static URLs available while WordPress is temporarily down. */ }
  if (settings.host_enabled) {
    try {
      const landing = await getPublicHostData<{ hosts: HostSummary[] }>("host");
      for (const host of landing?.hosts || []) if (host.slug) urls.push({ url: publicUrl(origin, `/host/${encodeURIComponent(host.slug)}`) });
    } catch { /* Public host directory may be unavailable. */ }
  }
  return urls;
}
