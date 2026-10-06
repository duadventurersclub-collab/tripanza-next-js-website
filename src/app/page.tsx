import HomePage from "@/components/home/HomePage";
import { publicPageMetadata } from "@/lib/search-discovery";

export const dynamic = "force-dynamic";

export const generateMetadata = async () => publicPageMetadata(
  "/", "Tripanza | Curated Group Trips in India",
  "Discover curated group trips, upcoming departures and real travel experiences with Tripanza.",
);

export default function Home() {
  return <HomePage live />;
}
