import type { Metadata } from "next";
import MetaReelsFeed from "@/components/reels/MetaReelsFeed";
import { getMetaReels } from "@/lib/meta-reels";
import { getSiteSettings } from "@/lib/site-settings";
import { redirect } from "next/navigation";
import "./meta-reels.css";
import { publicPageMetadata } from "@/lib/search-discovery";

export const revalidate = 300;

export const generateMetadata = (): Promise<Metadata> => publicPageMetadata("/trips", "Trip Drops", "Watch real group-trip moments and find your next escape.");

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ reel?: string }> }) {
  if (!(await getSiteSettings()).reels_enabled) redirect("/tours");
  const [items, params] = await Promise.all([getMetaReels(), searchParams]);
  const requestedId = Number(params.reel) || 0;
  const requestedIndex = requestedId ? items.findIndex((item) => item.id === requestedId) : 0;
  return <MetaReelsFeed items={items} initialIndex={requestedIndex >= 0 ? requestedIndex : 0} />;
}
