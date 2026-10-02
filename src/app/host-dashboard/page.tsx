import HostPrivatePage from "@/components/host/HostPrivatePage";
import HostDashboardOriginal from "@/components/host/HostDashboardOriginal";
import { getPrivateHostData, type HostDashboard } from "@/lib/host";

export default async function HostDashboardPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { setup } = await searchParams;
  return <HostPrivatePage path="/host-dashboard" original load={() => getPrivateHostData<HostDashboard>("host/dashboard")}>{(profile, data) => {
    if (!data) return <div role="alert">Host dashboard is unavailable. Check that the updated WordPress Host API is installed, then refresh.</div>;
    return <HostDashboardOriginal profile={profile} data={data} setup={setup} />;
  }}</HostPrivatePage>;
}
