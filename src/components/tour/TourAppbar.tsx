"use client";

import { useEffect, useRef, useState } from "react";
import type { TourDetail } from "@/lib/wp";

interface TourAppbarProps {
  tour: TourDetail;
}


export default function TourAppbar({ tour }: TourAppbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("Ready to paste");
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 44);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const handleBack = (e: React.MouseEvent) => {
    if (document.referrer && new URL(document.referrer, window.location.href).hostname === window.location.hostname && window.history.length > 1) {
      e.preventDefault();
      window.history.back();
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: document.title, text: "Explore this Tripanza experience", url: window.location.href }).catch((err) => {
        if (!err || err.name !== "AbortError") setShareOpen(true);
      });
    } else {
      setShareOpen(true);
    }
  };

  const closeShare = () => setShareOpen(false);

  const handleCopy = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(window.location.href).then(() => {
        setCopyStatus("Link copied");
        setTimeout(closeShare, 550);
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = window.location.href;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopyStatus("Link copied");
      setTimeout(closeShare, 550);
    }
  };

  const rating = tour.details.rating;
  // Share URLs are computed client-side only to avoid SSR "window is not defined"
  const [shareUrls, setShareUrls] = useState({ whatsapp: "#", telegram: "#" });
  useEffect(() => {
    const pageUrl = window.location.href;
    const text = encodeURIComponent(`Have a look at this Tripanza experience: ${tour.title}`);
    setShareUrls({
      whatsapp: `https://wa.me/?text=${text}%0A${encodeURIComponent(pageUrl)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(tour.title)}`,
    });
  }, [tour.title]);

  return (
    <>
      <nav className={`tp-tour-appbar${isScrolled ? " is-scrolled" : ""}`} aria-label="Tour navigation">
        <a
          className="tp-tour-appbar__action"
          href="/tours"
          onClick={handleBack}
          aria-label="Go back"
        >
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        </a>

        <div className="tp-tour-appbar__title" aria-hidden="true">{tour.title}</div>

        {rating.value > 0 && rating.count > 0 ? (
          <span
            className="tp-tour-appbar__rating"
            aria-label={`${rating.value.toFixed(1)} out of 5 from ${rating.count} reviews`}
          >
            <i className="fa-solid fa-star" aria-hidden="true" />
            <strong>{rating.value.toFixed(1)}</strong>
            <small>{rating.count} reviews</small>
          </span>
        ) : (
          <span className="tp-tour-appbar__rating-placeholder" aria-hidden="true" />
        )}

        <button
          className="tp-tour-appbar__action"
          type="button"
          onClick={handleShare}
          aria-label="Share this trip"
        >
          <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
        </button>
      </nav>

      {/* Share Overlay */}
      <div
        ref={overlayRef}
        className={`tp-share-overlay${shareOpen ? " is-open" : ""}`}
        onClick={closeShare}
        hidden={!shareOpen}
        aria-hidden="true"
      />

      {/* Share Sheet */}
      <section
        ref={sheetRef}
        className={`tp-share-sheet${shareOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-share-title"
        hidden={!shareOpen}
      >
        <div className="tp-share-sheet__handle" aria-hidden="true" />
        <div className="tp-share-sheet__head">
          <div>
            <span>Share the escape</span>
            <h2 id="tp-share-title">Send this trip to your people</h2>
          </div>
          <button type="button" onClick={closeShare} aria-label="Close share options">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="tp-share-sheet__options">
          <a href={shareUrls.whatsapp} target="_blank" rel="noopener noreferrer">
            <span className="tp-share-sheet__icon tp-share-sheet__icon--whatsapp">
              <i className="fa-brands fa-whatsapp" aria-hidden="true" />
            </span>
            <strong>WhatsApp</strong>
            <small>Send instantly</small>
          </a>
          <a href={shareUrls.telegram} target="_blank" rel="noopener noreferrer">
            <span className="tp-share-sheet__icon tp-share-sheet__icon--telegram">
              <i className="fa-brands fa-telegram" aria-hidden="true" />
            </span>
            <strong>Telegram</strong>
            <small>Share privately</small>
          </a>
          <button type="button" onClick={handleCopy}>
            <span className="tp-share-sheet__icon tp-share-sheet__icon--copy">
              <i className="fa-solid fa-link" aria-hidden="true" />
            </span>
            <strong>Copy link</strong>
            <small>{copyStatus}</small>
          </button>
        </div>
      </section>
    </>
  );
}
