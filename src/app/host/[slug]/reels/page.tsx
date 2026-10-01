import { notFound } from "next/navigation";
import { getPublicHostData, type HostProfile, type HostReel } from "@/lib/host";
import HostReelFeed from "@/components/host/HostReelFeed";
import "@/components/host/host.css";

export default async function HostPublicReelsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [profile, data] = await Promise.all([
    getPublicHostData<HostProfile>(`host/profile/${encodeURIComponent(slug)}`, 0),
    getPublicHostData<{ items: HostReel[] }>(`host/profile/${encodeURIComponent(slug)}/reels`, 0),
  ]);
  if (!profile) notFound();
  return <HostReelFeed profile={profile} items={data?.items || []} />;
}
