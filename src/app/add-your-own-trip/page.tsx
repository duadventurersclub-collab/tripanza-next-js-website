import HostPrivatePage from "@/components/host/HostPrivatePage";
import HostOriginalStudio from "@/components/host/HostOriginalStudio";
import { getStudioDocument, studioSearch } from "@/lib/host-studio";
import { redirect } from "next/navigation";

export const metadata = { title: "Add Your Own Trip | Tripanza Host" };

export default async function AddYourOwnTripPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const search = studioSearch(query).toString();
  const path = `/add-your-own-trip${search ? `?${search}` : ""}`;
  return <HostPrivatePage path={path} original load={() => getStudioDocument("trips", query)}>{(_profile, document) => {
    if (document.redirect) redirect(document.redirect);
    return <HostOriginalStudio document={document} title="Tripanza Host Trip Studio" />;
  }}</HostPrivatePage>;
}
