import HostPrivatePage from "@/components/host/HostPrivatePage";
import HostReelsManager from "@/components/host/HostReelsManager";
import { getPrivateHostData, type HostReel } from "@/lib/host";

export default function HostReelsPage() {
  return <HostPrivatePage path="/host-reels" original load={() => getPrivateHostData<{ items: HostReel[] }>("host/reels")}>{(profile, data) => {
    return <HostReelsManager initial={data?.items || []} tours={profile.trips} slug={profile.slug} />;
  }}</HostPrivatePage>;
}
