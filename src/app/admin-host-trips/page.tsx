import HostPrivatePage from "@/components/host/HostPrivatePage";
import HostTripSelector from "@/components/host/HostTripSelector";
import { getPrivateHostData, type HostTour } from "@/lib/host";

export default function HostTripsPage() {
  return <HostPrivatePage path="/admin-host-trips" original load={() => getPrivateHostData<{ items: HostTour[] }>("host/master-trips")}>{(_profile, data) => {
    return <HostTripSelector items={data?.items || []} />;
  }}</HostPrivatePage>;
}
