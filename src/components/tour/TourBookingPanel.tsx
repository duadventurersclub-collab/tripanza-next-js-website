"use client";

import Link from "next/link";
import { useState } from "react";
import type { TourDetail } from "@/lib/wp";

type Sharing = "quad" | "triple" | "twin";
const labels: Record<Sharing, { title: string; occupancy: string }> = {
  quad: { title: "Quad Sharing", occupancy: "4 / room" },
  triple: { title: "Triple Sharing", occupancy: "3 / room" },
  twin: { title: "Twin Sharing", occupancy: "2 / room" },
};

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function dateParts(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? { day: value, month: "" } : {
    day: parsed.toLocaleDateString("en-IN", { day: "2-digit" }),
    month: parsed.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
  };
}

export default function TourBookingPanel({ tour }: { tour: TourDetail }) {
  const options = (["quad", "triple", "twin"] as Sharing[]).filter((key) => Boolean(tour.details.pricing[key]));
  const [sharing, setSharing] = useState<Sharing>(options[0] || "quad");
  const [travellers, setTravellers] = useState(1);
  const [departureIndex, setDepartureIndex] = useState(0);
  const departure = tour.details.departures[departureIndex];
  const price = tour.details.pricing[sharing]?.amount || 0;
  const bookingHref = `/booking?tour=${tour.id}${departure ? `&date=${encodeURIComponent(departure.date)}` : ""}&sharing=${sharing}&travellers=${travellers}`;

  return (
    <aside className="tp-tour-sidebar" aria-label="Book this tour" id="booking-request">
      <div className="tp-booking-panel">
        <header className="tp-booking-panel__intro"><span><i className="fa-solid fa-lock" aria-hidden="true" /></span><div><small>Secure booking</small><strong>Plan your trip</strong></div></header>
        <div className="tp-booking-benefits"><span><b>✓</b><small>Live ST Tours</small><strong>Server-verified fare</strong></span><span><i className="fa-solid fa-check" /> Takes 2 min</span></div>
        <ol className="tp-booking-progress" aria-label="Booking progress">{["Date", "Travellers", "Extras", "Payment"].map((label, index) => <li className={index === 0 ? "is-active" : ""} key={label}><span>{index + 1}</span><small>{label}</small></li>)}</ol>

        <section className="tp-booking-step"><header><span>01</span><div><strong>Select departure</strong><small>Choose a live batch</small></div></header>{tour.details.departures.length ? <div className="tp-booking-dates">{tour.details.departures.map((item, index) => { const parts = dateParts(item.date); return <button type="button" className={index === departureIndex ? "is-active" : ""} onClick={() => setDepartureIndex(index)} key={`${item.date}-${index}`}><strong>{parts.day}</strong><small>{parts.month}</small></button>; })}</div> : <p className="tp-booking-empty">No online departure is currently available.</p>}{departure ? <div className="tp-booking-availability"><i /><span><strong>{departure.status}</strong><small>This departure will be checked again before checkout.</small></span><b>Live</b></div> : null}</section>

        <section className="tp-booking-step"><header><span>02</span><div><strong>Choose room sharing</strong><small>Published price per traveller</small></div></header><div className="tp-booking-sharing">{options.map((key) => <button type="button" className={key === sharing ? "is-active" : ""} onClick={() => setSharing(key)} key={key}><strong>{labels[key].title}</strong>{key === "triple" ? <em>Popular</em> : null}<small>{labels[key].occupancy}</small></button>)}</div></section>

        <section className="tp-booking-step tp-booking-travellers"><header><span>03</span><div><strong>How many travellers?</strong><small>{labels[sharing].title} · {labels[sharing].occupancy}</small></div></header><div className="tp-booking-counter"><button type="button" onClick={() => setTravellers((value) => Math.max(1, value - 1))} aria-label="Remove one traveller">−</button><strong>{travellers}</strong><button type="button" onClick={() => setTravellers((value) => Math.min(tour.details.capacity || 30, value + 1))} aria-label="Add one traveller">+</button></div></section>

        <div className="tp-booking-price-card"><span><i className="fa-solid fa-check" />{labels[sharing].title}</span><strong>{money(price)}<small>Published / person</small></strong></div>
        <section className="tp-booking-total"><header><div><small>Next step</small><strong>Build your verified cart</strong></div><span>Live pricing</span></header><p className="tp-booking-empty">ST Tours will calculate the date price, discounts, extras, tax, advance, and balance.</p>{departure ? <Link href={bookingHref} className="tp-booking-submit"><span>Continue to booking</span><i className="fa-solid fa-arrow-right" /></Link> : <span className="tp-booking-submit" aria-disabled="true"><span>Departure unavailable</span></span>}<div className="tp-booking-assurance"><span>● ST order</span><span>● Secure payment</span></div></section>
      </div>
    </aside>
  );
}
