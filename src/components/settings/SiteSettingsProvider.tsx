"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/site-settings-types";
import { isHostPath } from "@/lib/host-paths";
import HostUnavailable from "@/components/host/HostUnavailable";

const Context = createContext<SiteSettings>(DEFAULT_SETTINGS);
export const useSiteSettings = () => useContext(Context);

export default function SiteSettingsProvider({ initial, children }: { initial: SiteSettings; children: React.ReactNode }) {
  const [live, setLive] = useState(initial);
  const pathname = usePathname();
  const router = useRouter();
  const previous = useRef(initial);
  useEffect(() => {
    let active = true;
    const refresh = () => void fetch("/api/settings/public", { cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then(response => { if (!response.ok) throw new Error("Settings unavailable"); return response.json(); }).then((settings: SiteSettings) => {
        if (!active) return;
        if (typeof settings.host_enabled !== "boolean") throw new Error("Invalid settings response");
        const changed = previous.current.host_enabled !== settings.host_enabled;
        previous.current = settings;
        setLive(settings);
        if (changed) router.refresh();
      }).catch(() => {
        // Fail closed for Host even when the app itself loses connectivity.
        if (active) setLive(current => ({ ...current, host_enabled: false }));
      });
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("tripanza:settings-changed", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("tripanza:settings-changed", refresh); };
  }, [pathname, router]);
  return <Context.Provider value={live}>{isHostPath(pathname) && !live.host_enabled ? <HostUnavailable /> : children}</Context.Provider>;
}
