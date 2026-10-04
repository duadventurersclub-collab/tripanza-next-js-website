"use client";
/* eslint-disable @next/next/no-img-element -- preserve the original menu logo */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clearAdminSnapshots } from "./useAdminSnapshot";
import { useSiteSettings } from "@/components/settings/SiteSettingsProvider";
import "./admin-menu-original.css";

const sections = [
  { label: "Overview", items: [["/admin", "fa-gauge-high", "Main Dashboard"], ["/crm/", "fa-address-book", "CRM / Leads"], ["/web-chatbot-dashboard/", "fa-inbox", "AI Inbox"]] },
  { label: "Bookings", items: [["/admin/bookings", "fa-clipboard-list", "Booking History"], ["/admin/bookings/create", "fa-calendar-plus", "Create Booking"]] },
  { label: "Tours & Content", items: [["/add-your-own-trip", "fa-route", "Add / Edit Trips"], ["/tripwise-costing/", "fa-calculator", "Tripwise Costing"], ["/poster-download", "fa-image", "Poster Download"]] },
  { label: "Hosts & Sales", items: [["/list-of-hosts-for-admin/", "fa-user-group", "List of Hosts"], ["/tripanza-global-host-commission-by-admin/", "fa-hand-holding-dollar", "Host Commission"], ["/admin-sales-campaign-cashback/", "fa-tags", "Sale Campaigns"]] },
  { label: "Tripanza Finance", items: [["/tripanza-financials/", "fa-wallet", "Inflow/Outflow/Profits"]] },
  { label: "System", items: [["/admin/whatsapp", "fa-comment-dots", "WhatsApp Bots"], ["/admin-activity-logs/", "fa-clock-rotate-left", "Activity Logs"], ["/admin/settings", "fa-sliders", "Site Settings"]] },
];
const appPages = new Set(["/admin", "/admin/bookings", "/admin/bookings/create", "/admin/settings", "/admin/whatsapp", "/add-your-own-trip", "/poster-download"]);
export default function AdminMenu({ name, wordpressOrigin }: { name: string; wordpressOrigin: string }) {
  const settings = useSiteSettings();
  const visible = (path: string) => path === "/admin" ? settings.admin_dashboard_enabled : path === "/admin/bookings" ? settings.admin_booking_history_enabled : path === "/admin/bookings/create" ? settings.admin_booking_create_enabled : true;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  useEffect(() => {
    // Do not suspend the settings form on an external icon stylesheet.
    if (document.getElementById("tripanza-admin-icons")) return;
    const stylesheet = document.createElement("link");
    stylesheet.id = "tripanza-admin-icons";
    stylesheet.rel = "stylesheet";
    stylesheet.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    stylesheet.crossOrigin = "anonymous";
    stylesheet.referrerPolicy = "no-referrer";
    document.head.appendChild(stylesheet);
  }, []);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    const trigger = openButton.current;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const nodes = menu.current?.querySelectorAll<HTMLElement>('a[href],button');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); trigger?.focus(); };
  }, [open]);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: document.title, url: location.href });
      else { await navigator.clipboard.writeText(location.href); setShareStatus("Link copied to clipboard."); }
    } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setShareStatus("Could not share this page."); }
  }
  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      clearAdminSnapshots();
      // Full reload clears private dashboard/profile client state after logout.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } catch { setShareStatus("Could not sign out. Please try again."); }
  }
  return <>
    <button ref={openButton} type="button" className="tp-admin-menu-toggle" aria-label="Open admin menu" aria-expanded={open} aria-controls="adminMenu" onClick={() => setOpen(true)}><i aria-hidden="true" className="fa-solid fa-bars" /></button>
    <button type="button" className="tp-admin-share-toggle" aria-label="Share this page" onClick={share}><i aria-hidden="true" className="fa-solid fa-share-nodes" /></button>
    {shareStatus && <p className="admin-share-status" role="status">{shareStatus}</p>}
    <div className={`tp-admin-menu-overlay${open ? " is-active" : ""}`} aria-hidden="true" onClick={() => setOpen(false)} />
    <nav ref={menu} id="adminMenu" className={`tp-admin-menu-drawer${open ? " is-active" : ""}`} aria-label="Tripanza admin navigation" inert={!open}>
      <div className="tp-admin-menu-header"><div className="tp-admin-menu-brand"><img className="tp-admin-menu-logo" src="https://tripanza.com/wp-content/uploads/2026/04/Tripanza-Logo-3.png" alt="Tripanza" /><div><strong className="tp-admin-menu-title">Tripanza Admin</strong><span className="tp-admin-menu-role">Administrator Menu</span></div></div><button ref={closeButton} type="button" className="tp-admin-menu-close" aria-label="Close menu" onClick={() => setOpen(false)}><i aria-hidden="true" className="fa-solid fa-xmark" /></button></div>
      <div className="tp-admin-menu-user"><div className="tp-admin-menu-user__avatar"><i aria-hidden="true" className="fa-solid fa-user-shield" /></div><div className="tp-admin-menu-user__meta"><span className="tp-admin-menu-user__greeting">Signed in as</span><strong>{name}</strong></div></div>
      <div className="tp-admin-menu-links">{sections.map(section => <div className="tp-admin-menu-section" key={section.label}><span className="tp-admin-menu-section__label">{section.label}</span>{section.items.filter(([path]) => visible(path)).map(([path, icon, label]) => {
        const active = pathname === path;
        const content = <><span className="tp-admin-menu-link__icon"><i aria-hidden="true" className={`fa-solid ${icon}`} /></span><span className="tp-admin-menu-link__text">{label}</span>{active && <i className="fa-solid fa-chevron-right tp-admin-menu-link__active-mark" aria-hidden="true" />}</>;
        return appPages.has(path) ? <Link key={path} href={path} className={`tp-admin-menu-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>{content}</Link> : <a key={path} href={wordpressOrigin + path} className="tp-admin-menu-link">{content}</a>;
      })}</div>)}<div className="tp-admin-menu-footer"><Link href="/" className="tp-admin-menu-link tp-admin-menu-link--outline"><span className="tp-admin-menu-link__icon"><i aria-hidden="true" className="fa-solid fa-house" /></span><span className="tp-admin-menu-link__text">Tripanza Homepage</span></Link><button type="button" className="tp-admin-menu-link tp-admin-menu-link--danger admin-menu-logout" onClick={logout}><span className="tp-admin-menu-link__icon"><i aria-hidden="true" className="fa-solid fa-right-from-bracket" /></span><span className="tp-admin-menu-link__text">Logout</span></button></div></div>
    </nav>
  </>;
}
