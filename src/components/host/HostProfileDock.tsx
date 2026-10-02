"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HostProfile } from "@/lib/host";
import { hostThemes, hostThemeStyle } from "./profile-themes";

const phoneIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h3l1 5-2 1c1 3 3 5 6 6l1-2 5 1v3c0 2-2 4-4 4C9 20 4 15 3 7c0-2 2-4 4-4Z" /></svg>;
const whatsappIcon = <svg className="tp-host-whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" /><path d="M8.7 7.8c.4 3.4 2.2 5.2 5.6 5.6M9 7.5l1.4-.4.8 2-1 .7M14.5 12l.7-1 2 .8-.4 1.4" /></svg>;

export default function HostProfileDock({ profile, dark = false }: { profile: HostProfile; dark?: boolean }) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches("input,textarea,select,[contenteditable=true]")) setKeyboardOpen(true);
    };
    const onFocusOut = () => window.setTimeout(() => setKeyboardOpen(false), 120);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => { document.removeEventListener("focusin", onFocusIn); document.removeEventListener("focusout", onFocusOut); };
  }, []);

  return <nav className={`tp-host-dock is-owner${keyboardOpen ? " is-keyboard-hidden" : ""}`} data-host-style={hostThemes[profile.theme]?.style || "classic"} data-host-dark={dark ? "1" : "0"} style={hostThemeStyle(profile.theme, profile.palette || {}, profile.font)} aria-label="Host actions">
    <Link className="is-active" href={`/host/${profile.slug}`} aria-current="page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg><span>Home</span></Link>
    {profile.call_url ? <a href={profile.call_url}>{phoneIcon}<span>Call</span></a> : <a aria-disabled="true" tabIndex={-1}>{phoneIcon}<span>Call</span></a>}
    <Link className="is-main" href={`/host/${profile.slug}/reels`}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M3 8h18M7 3l3 5M14 3l3 5M10 11l5 3-5 3v-6Z" /></svg><span>Reels</span></Link>
    {profile.help_whatsapp_url ? <a className="is-whatsapp" href={profile.help_whatsapp_url} target="_blank" rel="noopener noreferrer">{whatsappIcon}<span>WhatsApp</span></a> : <a className="is-whatsapp" aria-disabled="true" tabIndex={-1}>{whatsappIcon}<span>WhatsApp</span></a>}
    <Link href="/account" onClick={event => { event.preventDefault(); window.dispatchEvent(new Event("tripanza:open-profile")); }}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg><span>Me</span></Link>
  </nav>;
}
