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
  const [snapshot, setSnapshot] = useState({ pathname, settings: initial });
  // A layout survives navigation. Seed a new route from its fresh server
  // settings, not the previous page's disabled snapshot (important on re-enable).
  const live = snapshot.pathname === pathname ? snapshot.settings : initial;
  const router = useRouter();
  const previous = useRef(initial);
  const requestSequence = useRef(0);
  const hostEntryPage = pathname === "/host" || pathname === "/host/register";
  useEffect(() => {
    if (hostEntryPage && !live.host_enabled) router.replace("/tours");
  }, [hostEntryPage, live.host_enabled, router]);
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
        setSnapshot({ pathname, settings: { ...DEFAULT_SETTINGS, ...settings } });
        if (changed) router.refresh();
      }).catch(() => {
        // Fail closed for Host even when the app itself loses connectivity.
        if (active && sequence === requestSequence.current) {
          const changed = previous.current.host_enabled;
          previous.current = { ...previous.current, host_enabled: false };
          setSnapshot({ pathname, settings: previous.current });
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
  return <Context.Provider value={live}>{isHostPath(pathname) && !live.host_enabled ? hostEntryPage ? null : <HostUnavailable /> : children}</Context.Provider>;
}
