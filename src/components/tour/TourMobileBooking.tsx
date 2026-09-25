"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { TourDetail } from "@/lib/wp";
import TourAiChat from "./TourAiChat";
import TourBookingPanel from "./TourBookingPanel";

export const OPEN_TOUR_BOOKING_EVENT = "tripanza:open-booking";

export default function TourMobileBooking({ tour, whatsappUrl }: { tour: TourDetail; whatsappUrl: string }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const openBooking = () => {
      if (window.matchMedia("(max-width: 1099px)").matches) setIsOpen(true);
    };
    window.addEventListener(OPEN_TOUR_BOOKING_EVENT, openBooking);
    return () => window.removeEventListener(OPEN_TOUR_BOOKING_EVENT, openBooking);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return <>
    <div className="tp-mobile-booking-bar" aria-label="Quick booking bar">
      <div><span>Your next adventure</span><strong>{tour.details.pricing.starting_price || tour.price || "Contact us"}</strong><small>Starting price · per person</small></div>
      <div className="tp-mobile-booking-actions"><a href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp inquiry"><i className="fa-brands fa-whatsapp" aria-hidden="true" /></a><button type="button" onClick={() => setIsOpen(true)}>Check dates <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button></div>
      <TourAiChat tour={tour} whatsappUrl={whatsappUrl} />
    </div>
    {isOpen && typeof document !== "undefined" ? createPortal(<div className="tp-mobile-booking-modal" role="dialog" aria-modal="true" aria-label="Book this tour"><button type="button" className="tp-mobile-booking-backdrop" onClick={() => setIsOpen(false)} aria-label="Close booking form" /><div className="tp-mobile-booking-sheet"><TourBookingPanel tour={tour} mobile onClose={() => setIsOpen(false)} /></div></div>, document.body) : null}
  </>;
}
