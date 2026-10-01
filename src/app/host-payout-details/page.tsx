import HostPrivatePage from "@/components/host/HostPrivatePage";
import HostPayoutForm from "@/components/host/HostPayoutForm";
import { getPrivateHostData, type HostPayout } from "@/lib/host";

export default function HostPayoutPage() {
  return <HostPrivatePage path="/host-payout-details">{async () => {
    const payout = await getPrivateHostData<HostPayout>("host/payout");
    return payout ? <HostPayoutForm initial={payout} /> : <div className="host-empty"><h3>Payout settings are unavailable.</h3><p>Check the Host API connection and refresh.</p></div>;
  }}</HostPrivatePage>;
}
