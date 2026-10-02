import Link from "next/link";
import type { HostProfile } from "@/lib/host";
import { hostThemes, hostThemeStyle } from "./profile-themes";

export default function HostProfileDock({ profile, dark = false }: { profile: HostProfile; dark?: boolean }) {
  return <nav className="tp-host-dock is-owner" data-host-style={hostThemes[profile.theme]?.style || "classic"} data-host-dark={dark ? "1" : "0"} style={hostThemeStyle(profile.theme, profile.palette || {}, profile.font)} aria-label="Host actions">
    <Link className="is-active" href={`/host/${profile.slug}`} aria-current="page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg><span>Home</span></Link>
    {profile.call_url ? <a href={profile.call_url}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h3l1 5-2 1c1 3 3 5 6 6l1-2 5 1v3c0 2-2 4-4 4C9 20 4 15 3 7c0-2 2-4 4-4Z" /></svg><span>Call</span></a> : <span aria-disabled="true">☎ Call</span>}
    <Link className="is-main" href={`/host/${profile.slug}/reels`}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M3 8h18M7 3l3 5M14 3l3 5M10 11l5 3-5 3v-6Z" /></svg><span>Reels</span></Link>
    {profile.help_whatsapp_url ? <a className="is-whatsapp" href={profile.help_whatsapp_url} target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" /><path d="M8.7 7.8c.4 3.4 2.2 5.2 5.6 5.6M9 7.5l1.4-.4.8 2-1 .7M14.5 12l.7-1 2 .8-.4 1.4" /></svg><span>WhatsApp</span></a> : <span aria-disabled="true">WhatsApp</span>}
    <Link href="/account"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg><span>Me</span></Link>
  </nav>;
}
