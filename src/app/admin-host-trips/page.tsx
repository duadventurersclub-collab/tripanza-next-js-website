import HostPrivatePage from "@/components/host/HostPrivatePage";
import HostTripSelector from "@/components/host/HostTripSelector";
import { getPrivateHostData, type HostTour } from "@/lib/host";

export default function HostTripsPage() {
  return <HostPrivatePage path="/admin-host-trips" original>{async () => {
    const data = await getPrivateHostData<{ items: HostTour[] }>("host/master-trips");
    return <HostTripSelector items={data?.items || []} />;
  }}</HostPrivatePage>;
}
