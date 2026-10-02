import { getSessionToken } from "@/lib/session";
import { getPrivateHostData, getPublicHostData, type HostProfile, type HostSummary, type HostTour } from "@/lib/host";
import { getUserProfile } from "@/lib/wp";
import HostLanding from "@/components/host/HostLanding";
import { getSiteSettings } from "@/lib/site-settings";
import HostUnavailable from "@/components/host/HostUnavailable";
import "@/components/host/host.css";

export const metadata = { title: "Become a Host | Tripanza" };

export default async function HostPage({ searchParams }: { searchParams: Promise<{ register?: string }> }) {
  if (!(await getSiteSettings()).host_enabled) return <HostUnavailable />;
  const token = await getSessionToken();
  const [landing, profile, account, params] = await Promise.all([
    getPublicHostData<{ trips: HostTour[]; hosts: HostSummary[]; leaderboard: { id: number; name: string; slug: string; revenue: number; earnings: number; bookings: number }[] }>("host"),
    token ? getPrivateHostData<HostProfile>("host/me") : Promise.resolve(null),
    token ? getUserProfile(token) : Promise.resolve(null),
    searchParams,
  ]);
  return <HostLanding trips={landing?.trips || []} hosts={landing?.hosts || []} leaderboard={landing?.leaderboard || []} signedIn={Boolean(account)} accountEmail={account?.email || ""} isHost={Boolean(profile)} openInitially={params.register === "1"} />;
}
