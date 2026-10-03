"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { HostSummary } from "@/lib/host";
import { useSiteSettings } from "@/components/settings/SiteSettingsProvider";

const groups = [
  ["RUN THE CREW", [["Dashboard", "/host-dashboard"], ["Leads", "/crm"], ["Bookings", "/host-customer-booking-history"]]],
  ["BUILD TRIPS", [["Pick a Tripanza trip", "/admin-host-trips"], ["Reels", "/host-reels"]]],
  ["HOST MONEY", [["Wallet", "/host-wallet"], ["Payout details", "/host-payout-details"]]],
] as const;

export default function HostShell({ profile, children }: { profile: HostSummary; children: React.ReactNode }) {
  const settings = useSiteSettings();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const profileUrl = `/host/${profile.slug}`;
  return <div className="host-system host-private">
    <header className="hs-top"><button type="button" className="hs-menu-toggle" onClick={() => setOpen(true)} aria-label="Open host menu" aria-expanded={open}>☰</button><Link href="/host-dashboard" className="hs-wordmark"><span>T</span> Tripanza Host</Link><Link className="hs-avatar" href={profileUrl} aria-label="View public profile">{profile.logo ? <img src={profile.logo} alt="" /> : profile.name.slice(0, 1)}</Link></header>
    {open && <div className="hs-scrim" onClick={() => setOpen(false)} />}
    <aside className={`hs-drawer${open ? " is-open" : ""}`} aria-hidden={!open} aria-label="Host menu">
      <div className="hs-drawer-head"><span>TRIPANZA <b>Host Admin Menu</b></span><button type="button" onClick={() => setOpen(false)} aria-label="Close menu">×</button></div>
      <Link className="hs-drawer-profile" href={profileUrl} onClick={() => setOpen(false)}><span className="hs-avatar">{profile.logo ? <img src={profile.logo} alt="" /> : profile.name.slice(0, 1)}</span><span><small>PUBLIC HOST PROFILE</small><strong>{profile.name}</strong><em>View what travellers see</em></span><b>→</b></Link>
      <nav>{groups.map(([heading, links]) => <section key={heading}><h2>{heading}</h2>{links.filter(([, href]) => settings.reels_enabled || href !== "/host-reels").map(([name, href]) => <Link key={href} className={pathname === href ? "is-active" : ""} href={href} onClick={() => setOpen(false)}>{name}<span>›</span></Link>)}</section>)}</nav>
      <div className="hs-drawer-foot"><Link href="/">Back to Tripanza</Link><button type="button" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${profileUrl}`); setOpen(false); }}>Share profile</button></div>
    </aside>
    <main className="hs-main">{children}</main>
  </div>;
}
