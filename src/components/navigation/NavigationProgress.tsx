"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const indicatorRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const indicator = indicatorRef.current;
    indicator?.classList.remove("is-active");
    indicator?.setAttribute("aria-hidden", "true");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, [pathname, searchParams]);

  useEffect(() => {
    function showProgress() {
      const indicator = indicatorRef.current;
      indicator?.classList.add("is-active");
      indicator?.setAttribute("aria-hidden", "false");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // A failed or cancelled navigation must never leave the indicator stuck.
      timeoutRef.current = setTimeout(() => {
        indicator?.classList.remove("is-active");
        indicator?.setAttribute("aria-hidden", "true");
        timeoutRef.current = null;
      }, 12000);
    }

    function handleClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;

      const destination = new URL(link.href, window.location.href);
      const current = window.location;
      if (destination.origin !== current.origin || (destination.pathname === current.pathname && destination.search === current.search)) return;

      showProgress();
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("tripanza:navigation-start", showProgress);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("tripanza:navigation-start", showProgress);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div ref={indicatorRef} className="tp-navigation-progress" role="status" aria-label="Opening page" aria-hidden="true">
      <span className="tp-navigation-progress__bar" />
    </div>
  );
}
