import HomePage from "@/components/home/HomePage";
import { getPublicSiteSettings } from "@/lib/public-site-settings";
import { publicPageMetadata } from "@/lib/search-discovery";

// No build-time WordPress dependency: generate this page on first request.
export const revalidate = 300;
export function generateStaticParams() { return []; }

export const generateMetadata = async () => publicPageMetadata(
  "/", "Tripanza | Curated Group Trips in India",
  "Discover curated group trips, upcoming departures and real travel experiences with Tripanza.",
  undefined, await getPublicSiteSettings(),
);

export default function CachedHome() {
  return <HomePage />;
}
