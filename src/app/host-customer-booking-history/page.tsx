import HostPrivatePage from "@/components/host/HostPrivatePage";
import HostBookings from "@/components/host/HostBookings";
import { getPrivateHostData, type HostBooking } from "@/lib/host";

export default function HostBookingsPage() {
  return <HostPrivatePage path="/host-customer-booking-history" original>{async () => {
    const data = await getPrivateHostData<{ items: HostBooking[] }>("host/bookings");
    return <HostBookings initial={data?.items || []} />;
  }}</HostPrivatePage>;
}
