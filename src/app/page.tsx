import { getAppTours, getSiteConfig, getTourBySlug, type SiteConfig, type TourDetail } from "@/lib/wp";
import HomeClient from "./HomeClient";
import "./home.css";
import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 300;

const fallbackSite: SiteConfig = {
  name: "Tripanza",
  description: "India's coolest travel community",
  url: "https://tripanza.com",
  admin_url: "",
  site_language: "en-IN",
  timezone: "Asia/Kolkata",
};

async function getHomepageTours(): Promise<TourDetail[]> {
  const settings = await getSiteSettings();
  const listing = await getAppTours({ per_page: 24, admin_only: true });
  const detailed = await Promise.allSettled(listing.items.map((tour) => getTourBySlug(tour.slug)));
  const base = detailed.map((result, index) => result.status === "fulfilled" && result.value ? result.value : listing.items[index]);
  const slugs = settings.featured_tour_slugs.split(",").map(slug => slug.trim()).filter(Boolean).slice(0, 12);
  const selected = await Promise.allSettled(slugs.map(slug => getTourBySlug(slug)));
  const featured = selected.flatMap(result => result.status === "fulfilled" && result.value ? [result.value] : []);
  return [...featured, ...base.filter(tour => !featured.some(item => item.id === tour.id))];
}

export default async function Home() {
  const [siteResult, toursResult] = await Promise.allSettled([getSiteConfig(), getHomepageTours()]);
  const site = siteResult.status === "fulfilled" ? siteResult.value : fallbackSite;
  const tours = toursResult.status === "fulfilled" ? toursResult.value : [];

  return <HomeClient siteName={site.name} tours={tours} />;
}
