"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSiteSettings } from "./SiteSettingsProvider";

export default function SiteAnnouncement() {
  const settings = useSiteSettings();
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  if (!settings.announcement_enabled || !settings.announcement_text) return null;
  const href = settings.announcement_link;
  return <aside className="tp-site-announcement" aria-label="Tripanza announcement">{href ? <Link href={href}>{settings.announcement_text} <span aria-hidden="true">→</span></Link> : settings.announcement_text}</aside>;
}
