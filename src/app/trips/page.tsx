import type { Metadata } from "next";
import MetaReelsFeed from "@/components/reels/MetaReelsFeed";
import { getMetaReels } from "@/lib/meta-reels";
import "./meta-reels.css";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Trip Drops | Tripanza",
  description: "Watch real group-trip moments and find your next escape.",
  alternates: { canonical: "/trips" },
  openGraph: {
    title: "Tripanza trip drops",
    description: "Watch real group-trip moments and find your next escape.",
    type: "video.other",
  },
};

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ reel?: string }> }) {
  const [items, params] = await Promise.all([getMetaReels(), searchParams]);
  const requestedId = Number(params.reel) || 0;
  const requestedIndex = requestedId ? items.findIndex((item) => item.id === requestedId) : 0;
  return <MetaReelsFeed items={items} initialIndex={requestedIndex >= 0 ? requestedIndex : 0} />;
}
