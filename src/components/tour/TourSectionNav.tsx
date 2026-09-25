"use client";

import { useEffect, useRef, useState } from "react";

export type TourSection = { id: string; label: string };

export default function TourSectionNav({ sections }: { sections: TourSection[] }) {
  const [active, setActive] = useState(sections[0]?.id || "");
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
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
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector<HTMLElement>(`[href="#${active}"]`);
    if (nav && item) nav.scrollTo({ left: item.offsetLeft - nav.clientWidth / 2 + item.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  return (
    <div className="tp-app-section-nav">
      <nav ref={navRef} aria-label="Explore this trip">
        {sections.map((section) => (
          <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? "location" : undefined}
            onClick={() => setActive(section.id)}>{section.label}</a>
        ))}
      </nav>
      <span className="tp-app-section-nav__brand">tripanza<span>®</span></span>
    </div>
  );
}
