import HostPrivatePage from "@/components/host/HostPrivatePage";
import HostReelsManager from "@/components/host/HostReelsManager";
import { getPrivateHostData, type HostReel } from "@/lib/host";
import { getSiteSettings } from "@/lib/site-settings";
import { redirect } from "next/navigation";

export default async function HostReelsPage() {
  if (!(await getSiteSettings()).reels_enabled) redirect("/host-dashboard");
  return <HostPrivatePage path="/host-reels" original load={() => getPrivateHostData<{ items: HostReel[] }>("host/reels")}>{(profile, data) => {
    return <HostReelsManager initial={data?.items || []} tours={profile.trips} slug={profile.slug} />;
  }}</HostPrivatePage>;
}
