import { getFeaturedTours, getSiteConfig } from "@/lib/wp";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [site, tours] = await Promise.all([getSiteConfig(), getFeaturedTours(9)]);

  return <HomeClient siteName={site.name} tours={tours.items} />;
}
