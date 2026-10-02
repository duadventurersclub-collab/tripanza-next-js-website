import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { getPrivateHostData, type HostProfile } from "@/lib/host";
import HostShell from "./HostShell";
import HostOriginalMenu from "./HostOriginalMenu";
import "./host.css";

export default async function HostPrivatePage({ path, children, original = false }: { path: string; children: (profile: HostProfile) => Promise<React.ReactNode> | React.ReactNode; original?: boolean }) {
  const token = await getSessionToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(path)}`);
  const profile = await getPrivateHostData<HostProfile>("host/me");
  if (!profile) redirect("/host?register=1");
  if (original) return <>{await children(profile)}<HostOriginalMenu profile={profile} /></>;
  return <HostShell profile={profile}>{await children(profile)}</HostShell>;
}
