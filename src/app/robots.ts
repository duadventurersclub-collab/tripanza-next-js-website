import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/site-settings";
import { publicOrigin, publicUrl } from "@/lib/search-discovery";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = publicOrigin((await getSiteSettings()).seo_site_url);
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/account", "/checkout", "/cart", "/payment", "/booking", "/login", "/dashboard", "/host-dashboard", "/host-wallet", "/host-payout-details", "/host-customer-booking-history", "/host-reels", "/crm", "/poster-download", "/add-your-own-trip"] }],
    sitemap: origin ? publicUrl(origin, "/sitemap.xml") : undefined,
  };
}
