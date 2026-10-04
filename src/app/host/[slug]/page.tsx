import { notFound } from "next/navigation";
import { getPrivateHostData, getPublicHostData, type HostProfile, type HostReel } from "@/lib/host";
import HostProfileView from "@/components/host/HostProfileView";
import { getSiteSettings } from "@/lib/site-settings";
import HostUnavailable from "@/components/host/HostUnavailable";
import "@/components/host/host.css";
import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/search-discovery";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicHostData<HostProfile>(`host/profile/${encodeURIComponent(slug)}`);
  if (!profile) return { title: "Host not found", robots: { index: false } };
  return publicPageMetadata(`/host/${encodeURIComponent(slug)}`, `${profile.name} - Tripanza Host`, profile.tagline || `Explore group trips hosted by ${profile.name} on Tripanza.`, profile.cover || profile.logo || undefined);
}

export default async function HostProfilePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ confirm_host_identity?: string }> }) {
  if (!(await getSiteSettings()).host_enabled) return <HostUnavailable />;
  const { slug } = await params;
  const { confirm_host_identity: token } = await searchParams;
  const confirmation = token
    ? await getPublicHostData<{ ok: boolean; message: string }>(`host/profile/${encodeURIComponent(slug)}/confirm?token=${encodeURIComponent(token)}`, 0)
    : null;
  const [profile, reelData, viewer] = await Promise.all([
    getPublicHostData<HostProfile>(`host/profile/${encodeURIComponent(slug)}`, 0),
    getPublicHostData<{ items: HostReel[] }>(`host/profile/${encodeURIComponent(slug)}/reels`, 0),
    getPrivateHostData<HostProfile>("host/me"),
  ]);
  if (!profile) notFound();
  return <HostProfileView initial={{ ...profile, phone: viewer?.id === profile.id ? viewer.phone : undefined }} reels={reelData?.items || []} owner={viewer?.id === profile.id} notice={token ? confirmation?.message || "This confirmation link is invalid or expired." : ""} />;
}
