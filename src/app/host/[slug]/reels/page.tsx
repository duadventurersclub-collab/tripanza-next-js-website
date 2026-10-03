import { notFound, redirect } from "next/navigation";
import { getPublicHostData, type HostProfile, type HostReel } from "@/lib/host";
import HostReelFeed from "@/components/host/HostReelFeed";
import { getSiteSettings } from "@/lib/site-settings";
import HostUnavailable from "@/components/host/HostUnavailable";
import "@/components/host/host.css";

export default async function HostPublicReelsPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await getSiteSettings()).host_enabled) return <HostUnavailable />;
  const { slug } = await params;
  if (!(await getSiteSettings()).reels_enabled) redirect(`/host/${encodeURIComponent(slug)}`);
  const [profile, data] = await Promise.all([
    getPublicHostData<HostProfile>(`host/profile/${encodeURIComponent(slug)}`, 0),
    getPublicHostData<{ items: HostReel[] }>(`host/profile/${encodeURIComponent(slug)}/reels`, 0),
  ]);
  if (!profile) notFound();
  return <HostReelFeed profile={profile} items={data?.items || []} />;
}
