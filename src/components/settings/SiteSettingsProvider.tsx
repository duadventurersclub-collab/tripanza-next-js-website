"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/site-settings-types";
import { isHostPath } from "@/lib/host-paths";
import HostUnavailable from "@/components/host/HostUnavailable";

const Context = createContext<SiteSettings>(DEFAULT_SETTINGS);
export const useSiteSettings = () => useContext(Context);

export default function SiteSettingsProvider({ initial, children }: { initial: SiteSettings; children: React.ReactNode }) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState({ pathname, settings: initial, verified: false });
  // The layout's display snapshot may be cached. Wait for live verification
  // before client redirects; protected pages/APIs enforce access server-side.
  const live = snapshot.pathname === pathname ? snapshot.settings : initial;
  const verified = snapshot.pathname === pathname && snapshot.verified;
  const router = useRouter();
  const previous = useRef(initial);
  const requestSequence = useRef(0);
  const hostEntryPage = pathname === "/host" || pathname === "/host/register";
  useEffect(() => {
      if (verified && hostEntryPage && !live.host_enabled) router.replace("/?tripanza_view=all#trips");
  }, [verified, hostEntryPage, live.host_enabled, router]);
  useEffect(() => {
    const disabled = pathname === "/admin" ? !live.admin_dashboard_enabled
      : pathname === "/admin/bookings" ? !live.admin_booking_history_enabled
      : pathname === "/admin/bookings/create" ? !live.admin_booking_create_enabled
      : /^\/admin\/bookings\/[1-9][0-9]*\/edit$/.test(pathname) && !live.admin_booking_editor_enabled;
    if (verified && disabled) router.replace("/admin/settings");
  }, [verified, pathname, live.admin_dashboard_enabled, live.admin_booking_history_enabled, live.admin_booking_create_enabled, live.admin_booking_editor_enabled, router]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const sequence = ++requestSequence.current;
      void fetch("/api/settings/public", { cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then(response => { if (!response.ok) throw new Error("Settings unavailable"); return response.json(); }).then((settings: SiteSettings) => {
        if (!active || sequence !== requestSequence.current) return;
        if (typeof settings.host_enabled !== "boolean") throw new Error("Invalid settings response");
        const changed = previous.current.revision !== settings.revision;
        previous.current = settings;
        setSnapshot({ pathname, settings: { ...DEFAULT_SETTINGS, ...settings }, verified: true });
        if (changed) router.refresh();
      }).catch(() => {
        // Fail closed for Host even when the app itself loses connectivity.
        if (active && sequence === requestSequence.current) {
          const changed = previous.current.host_enabled;
          previous.current = { ...previous.current, host_enabled: false };
          setSnapshot({ pathname, settings: previous.current, verified: true });
          if (changed) router.refresh();
        }
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("tripanza:settings-changed", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("tripanza:settings-changed", refresh); };
  }, [pathname, router]);
  return <Context.Provider value={live}>{verified && isHostPath(pathname) && !live.host_enabled ? hostEntryPage ? null : <HostUnavailable /> : children}</Context.Provider>;
}
