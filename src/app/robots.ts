import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/site-settings";
import { publicOrigin, publicUrl } from "@/lib/search-discovery";
import { buildRobotsRules } from "@/lib/robots-policy";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings();
  const origin = publicOrigin(settings.seo_site_url);
  return {
    rules: buildRobotsRules(settings.ai_search_crawlers_enabled, settings.ai_training_crawlers_enabled),
    sitemap: origin ? publicUrl(origin, "/sitemap.xml") : undefined,
  };
}
