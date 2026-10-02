"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { HostSummary } from "@/lib/host";
import "./menu-original.css";

const wordpress = (process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");
const groups = [
  ["RUN THE CREW", [["Dashboard", "/host-dashboard", "dashboard"], ["Leads", "/crm", "leads"], ["Bookings", "/host-customer-booking-history", "bookings"]]],
  ["BUILD TRIPS", [["Pick a Tripanza trip", "/admin-host-trips", "compass"], ["Add your own trip", `${wordpress}/add-your-own-trip/`, "plus"], ["Download posters", `${wordpress}/poster-download/`, "download"]]],
  ["HOST MONEY", [["Wallet", "/host-wallet", "wallet"], ["Payout details", "/host-payout-details", "bank"]]],
] as const;

const paths: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  leads: <><path d="M4 5h16v12H8l-4 3V5Z" /><path d="M8 9h8M8 13h5" /></>,
  bookings: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  download: <path d="M12 3v12M8 11l4 4 4-4M4 19h16" />,
  wallet: <><path d="M3 6h16v14H3V6Z" /><path d="M3 9h18v7h-5a3 3 0 0 1 0-6h5M16 13h.01" /></>,
  bank: <><path d="m3 9 9-5 9 5M5 10h14M6 10v7M10 10v7M14 10v7M18 10v7M4 18h16M3 21h18" /></>,
  home: <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-5 3.6-8 8-8s8 3 8 8" /></>,
};

function Icon({ name }: { name: string }) { return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name] || paths.compass}</svg>; }

export default function HostOriginalMenu({ profile }: { profile: HostSummary }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const pathname = usePathname();
  const button = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const profileUrl = `/host/${profile.slug}`;

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus({ preventScroll: true });
    document.body.classList.add("thm-menu-open");
    const launchButton = button.current;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.classList.remove("thm-menu-open"); window.removeEventListener("keydown", escape); launchButton?.focus({ preventScroll: true }); };
  }, [open]);

  async function share() {
    const url = `${window.location.origin}${profileUrl}`;
    try {
      if (navigator.share) await navigator.share({ title: `${profile.name} on Tripanza`, text: "Check out my Tripanza host profile", url });
      else { await navigator.clipboard.writeText(url); setToast(true); window.setTimeout(() => setToast(false), 1800); }
    } catch { /* Cancelled share. */ }
  }

  return <>
    <div className="thm-launcher"><button ref={button} className="thm-menu-button" type="button" onClick={() => setOpen(true)} aria-controls="tripanzaHostMenu" aria-expanded={open} aria-label="Open host menu"><span /><span /><span /></button></div>
    <div className={`thm-overlay${open ? " is-open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
    <aside className={`thm-drawer${open ? " is-open" : ""}`} id="tripanzaHostMenu" aria-hidden={!open} aria-label="Tripanza host navigation">
      <div className="thm-accent" />
      <header className="thm-head"><div><span>TRIPANZA</span><strong>Host Admin Menu</strong></div><button ref={closeButton} type="button" onClick={() => setOpen(false)} aria-label="Close host menu">×</button></header>
      <Link className="thm-profile" href={profileUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><span className="thm-avatar">{profile.logo ? <img src={profile.logo} alt="" /> : profile.name.slice(0, 1).toUpperCase()}</span><span><small>PUBLIC HOST PROFILE</small><strong>{profile.name}</strong><em>View what travellers see</em></span><i>→</i></Link>
      <nav className="thm-nav" aria-label="Host tools">{groups.map(([heading, links]) => <section key={heading}><h3>{heading}</h3>{links.map(([label, href, icon]) => { const active = pathname === href; return <Link href={href} key={label} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}><span><Icon name={icon} /></span><b>{label}</b>{active ? <small>YOU’RE HERE</small> : <i>›</i>}</Link>; })}</section>)}</nav>
      <footer className="thm-foot"><Link href="/" onClick={() => setOpen(false)}><Icon name="home" />Back to Tripanza</Link><button type="button" onClick={() => void share()}><Icon name="user" />Share host profile</button></footer>
    </aside>
    <div className={`thm-toast${toast ? " is-visible" : ""}`} role="status" aria-live="polite">Profile link copied ✓</div>
  </>;
}
