import HostPrivatePage from "@/components/host/HostPrivatePage";
import HostOriginalStudio from "@/components/host/HostOriginalStudio";
import { getStudioDocument } from "@/lib/host-studio";
import { redirect } from "next/navigation";

export const metadata = { title: "Download Posters | Tripanza Host" };

export default async function PosterDownloadPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <HostPrivatePage path="/poster-download" original load={() => getStudioDocument("posters", query)}>{(_profile, document) => {
    if (document.redirect) redirect(document.redirect);
    return <HostOriginalStudio document={document} title="AI Poster Generator" />;
  }}</HostPrivatePage>;
}
