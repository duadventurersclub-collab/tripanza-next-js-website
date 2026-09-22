import { getFeaturedTours, getSiteConfig, type SiteConfig } from "@/lib/wp";
import HomeClient from "./HomeClient";

export const revalidate = 300;

const fallbackSite: SiteConfig = {
  name: "Tripanza",
  description: "India's coolest travel community",
  url: "https://tripanza.com",
  admin_url: "",
  site_language: "en-IN",
  timezone: "Asia/Kolkata",
};

export default async function Home() {
  const [siteResult, toursResult] = await Promise.allSettled([getSiteConfig(), getFeaturedTours(9)]);
  const site = siteResult.status === "fulfilled" ? siteResult.value : fallbackSite;
  const tours = toursResult.status === "fulfilled" ? toursResult.value : { items: [], total: 0 };

  return <HomeClient siteName={site.name} tours={tours.items} />;
}
