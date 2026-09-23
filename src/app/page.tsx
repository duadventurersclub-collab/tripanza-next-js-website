import { getAppTours, getSiteConfig, getTourBySlug, type SiteConfig, type TourDetail } from "@/lib/wp";
import HomeClient from "./HomeClient";
import "./home.css";

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
  const listing = await getAppTours({ per_page: 24 });
  const detailed = await Promise.allSettled(listing.items.map((tour) => getTourBySlug(tour.slug)));
  return detailed.map((result, index) => result.status === "fulfilled" && result.value ? result.value : listing.items[index]);
}

export default async function Home() {
  const [siteResult, toursResult] = await Promise.allSettled([getSiteConfig(), getHomepageTours()]);
  const site = siteResult.status === "fulfilled" ? siteResult.value : fallbackSite;
  const tours = toursResult.status === "fulfilled" ? toursResult.value : [];

  return <HomeClient siteName={site.name} tours={tours} />;
}
