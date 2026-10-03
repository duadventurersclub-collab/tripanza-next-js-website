"use client";
import Link from "next/link";
import { useSiteSettings } from "./SiteSettingsProvider";

export default function SiteAnnouncement() {
  const settings = useSiteSettings();
  if (!settings.announcement_enabled || !settings.announcement_text) return null;
  const href = settings.announcement_link;
  return <aside className="tp-site-announcement" aria-label="Tripanza announcement">{href ? <Link href={href}>{settings.announcement_text} <span aria-hidden="true">→</span></Link> : settings.announcement_text}</aside>;
}
