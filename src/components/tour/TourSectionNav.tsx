"use client";

import { useEffect, useRef, useState } from "react";
import { scrollToTourSection } from "@/lib/tour-section-scroll";

export type TourSection = { id: string; label: string };

export default function TourSectionNav({ sections }: { sections: TourSection[] }) {
  const [active, setActive] = useState(sections[0]?.id || "");
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
    let legacyHashFrame = 0;
    const legacyHash = window.location.hash.slice(1);
    if (sections.some((section) => section.id === legacyHash) || legacyHash === "tp-info-availability") {
      // Existing shared section links still land on the section, then show the clean tour URL.
      legacyHashFrame = requestAnimationFrame(() => {
        document.getElementById(legacyHash)?.scrollIntoView({ block: "start" });
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
      });
    }
    const update = () => {
      frame = 0;
      let current = sections[0]?.id || "";
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= 170) current = section.id;
      }
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(legacyHashFrame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector<HTMLElement>(`[data-section-id="${active}"]`);
    if (nav && item) nav.scrollTo({ left: item.offsetLeft - nav.clientWidth / 2 + item.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  return (
    <div className="tp-app-section-nav">
      <nav ref={navRef} aria-label="Explore this trip">
        {sections.map((section) => (
          <button key={section.id} type="button" data-section-id={section.id} aria-current={active === section.id ? "location" : undefined}
            onClick={() => { setActive(section.id); scrollToTourSection(section.id); }}>{section.label}</button>
        ))}
      </nav>
      <span className="tp-app-section-nav__brand">tripanza<span>®</span></span>
    </div>
  );
}
