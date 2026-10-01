import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { getPrivateHostData, type HostProfile } from "@/lib/host";
import HostShell from "./HostShell";
import "./host.css";

export default async function HostPrivatePage({ path, children }: { path: string; children: (profile: HostProfile) => Promise<React.ReactNode> | React.ReactNode }) {
  const token = await getSessionToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(path)}`);
  const profile = await getPrivateHostData<HostProfile>("host/me");
  if (!profile) redirect("/host?register=1");
  return <HostShell profile={profile}>{await children(profile)}</HostShell>;
}
