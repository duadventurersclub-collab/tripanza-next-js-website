import HostPrivatePage from "@/components/host/HostPrivatePage";
import HostCustomTripBuilder from "@/components/host/HostCustomTripBuilder";

export const metadata = { title: "Add Your Own Trip | Tripanza Host" };

export default function AddYourOwnTripPage() {
  return <HostPrivatePage path="/add-your-own-trip" original>{profile => <HostCustomTripBuilder profile={profile} />}</HostPrivatePage>;
}
