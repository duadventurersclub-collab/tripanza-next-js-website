import HostPrivatePage from "@/components/host/HostPrivatePage";
import HostPosterStudio from "@/components/host/HostPosterStudio";

export const metadata = { title: "Download Posters | Tripanza Host" };

export default function PosterDownloadPage() {
  return <HostPrivatePage path="/poster-download" original>{profile => <HostPosterStudio profile={profile} />}</HostPrivatePage>;
}
