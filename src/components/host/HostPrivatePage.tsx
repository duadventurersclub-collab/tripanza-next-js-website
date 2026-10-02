import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { getPrivateHostData, type HostProfile } from "@/lib/host";
import HostShell from "./HostShell";
import HostOriginalMenu from "./HostOriginalMenu";
import "./host.css";

export default async function HostPrivatePage<T = undefined>({ path, children, load, original = false }: { path: string; children: (profile: HostProfile, data: T) => Promise<React.ReactNode> | React.ReactNode; load?: () => Promise<T>; original?: boolean }) {
  const token = await getSessionToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(path)}`);
  const [profile, data] = await Promise.all([
    getPrivateHostData<HostProfile>("host/me"),
    load ? load() : Promise.resolve(undefined as T),
  ]);
  if (!profile) redirect("/host?register=1");
  if (original) return <>{await children(profile, data)}<HostOriginalMenu profile={profile} /></>;
  return <HostShell profile={profile}>{await children(profile, data)}</HostShell>;
}
