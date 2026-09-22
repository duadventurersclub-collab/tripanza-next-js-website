"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookingSelection } from "@/lib/booking";
import type { TourDetail } from "@/lib/wp";

type Sharing = "quad" | "triple" | "twin";
const labels: Record<Sharing, { title: string; occupancy: string }> = {
  quad: { title: "Quad Sharing", occupancy: "4 / room" },
  triple: { title: "Triple Sharing", occupancy: "3 / room" },
  twin: { title: "Twin Sharing", occupancy: "2 / room" },
};

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function dateParts(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? { day: value, month: "" }
    : {
        day: parsed.toLocaleDateString("en-IN", { day: "2-digit" }),
        month: parsed.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      };
}

export default function TourBookingPanel({
  tour,
  mobile = false,
  onClose,
}: {
  tour: TourDetail;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const options = (["quad", "triple", "twin"] as Sharing[]).filter((key) => Boolean(tour.details.pricing[key]));
  const [sharing, setSharing] = useState<Sharing>(options[0] || "quad");
  const [travellers, setTravellers] = useState(1);
  const [departureIndex, setDepartureIndex] = useState(0);
  const [extras, setExtras] = useState<Record<string, boolean>>({});
  const [showExtras, setShowExtras] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const departure = tour.details.departures[departureIndex];
  const price = tour.details.pricing[sharing]?.amount || 0;
  const selectedExtras = tour.details.booking.extras.filter((extra) => extra.required || extras[extra.name]);
  const extrasTotal = selectedExtras.reduce((total, extra) => total + extra.price * (extra.required ? travellers : 1), 0);
  const estimate = price * travellers + extrasTotal;

  async function proceedToCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!departure || travellers < 1) {
      setError("Choose a departure and at least one traveller.");
      return;
    }

    const counts = { quad: 0, triple: 0, twin: 0 };
    counts[sharing] = travellers;
    const selection: BookingSelection = {
      tour_id: tour.id,
      date: departure.date,
      counts,
      extras: selectedExtras.map((extra) => ({ name: extra.name, quantity: extra.required ? travellers : 1 })),
    };

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      const result = (await response.json()) as { cart?: unknown; error?: string };
      if (!response.ok || !result.cart) throw new Error(result.error || "Unable to verify this booking.");
      router.push("/checkout");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue to checkout.");
      setIsSubmitting(false);
    }
  }

  return (
    <aside className={`tp-tour-sidebar${mobile ? " tp-tour-sidebar--mobile" : ""}`} aria-label="Book this tour" id={mobile ? "mobile-booking-request" : "booking-request"}>
      <form className="tp-booking-panel" onSubmit={proceedToCheckout}>
        <header className="tp-booking-panel__intro">
          <span><i className="fa-solid fa-lock" aria-hidden="true" /></span>
          <div><small>Secure booking</small><strong>Plan your trip</strong></div>
          {mobile ? <button type="button" className="tp-booking-close" onClick={onClose} aria-label="Close booking form">×</button> : null}
        </header>
        <div className="tp-booking-benefits"><span><b>✓</b><small>Live ST Tours</small><strong>Server-verified fare</strong></span><span><i className="fa-solid fa-check" /> Takes 2 min</span></div>
        <ol className="tp-booking-progress" aria-label="Booking progress">{["Date", "Travellers", "Extras", "Payment"].map((label, index) => <li className={index < 3 ? "is-complete" : "is-active"} key={label}><span>{index < 3 ? "✓" : index + 1}</span><small>{label}</small></li>)}</ol>

        <section className="tp-booking-step">
          <header><span>01</span><div><strong>Select departure</strong><small>Choose the batch that works for you</small></div></header>
          {tour.details.departures.length ? <div className="tp-booking-dates">{tour.details.departures.map((item, index) => { const parts = dateParts(item.date); return <button type="button" className={index === departureIndex ? "is-active" : ""} onClick={() => { setDepartureIndex(index); setError(""); }} key={`${item.date}-${index}`}><strong>{parts.day}</strong><small>{parts.month}</small></button>; })}</div> : <p className="tp-booking-empty">No online departure is currently available.</p>}
          {departure ? <div className="tp-booking-availability"><i /><span><strong>{departure.status}</strong><small>This departure is verified again before checkout.</small></span><b>Live</b></div> : null}
        </section>

        <section className="tp-booking-step">
          <header><span>02</span><div><strong>Choose room sharing</strong><small>The package price is per traveller</small></div></header>
          <div className="tp-booking-sharing">{options.map((key) => <button type="button" className={key === sharing ? "is-active" : ""} onClick={() => { setSharing(key); setError(""); }} key={key}><strong>{labels[key].title}</strong>{key === "triple" ? <em>Recommended</em> : null}<small>{labels[key].occupancy}</small></button>)}</div>
        </section>

        <section className="tp-booking-step tp-booking-travellers">
          <header><span>03</span><div><strong>How many travellers?</strong><small>{labels[sharing].title} · {labels[sharing].occupancy}</small></div></header>
          <div className="tp-booking-counter"><button type="button" onClick={() => setTravellers((value) => Math.max(1, value - 1))} aria-label="Remove one traveller">−</button><strong>{travellers}</strong><button type="button" onClick={() => setTravellers((value) => Math.min(tour.details.capacity || 30, value + 1))} aria-label="Add one traveller">+</button></div>
        </section>

        <div className="tp-booking-price-card"><span><i className="fa-solid fa-check" />{labels[sharing].title}</span><strong>{money(price, tour.currency)}<small>Per person</small></strong></div>

        {tour.details.booking.extras.length ? <section className="tp-booking-extras">
          <button type="button" className="tp-booking-extras__toggle" onClick={() => setShowExtras((value) => !value)} aria-expanded={showExtras}><span><b>04</b><span><strong>Optional add-ons</strong><small>{selectedExtras.length ? `${selectedExtras.length} selected` : "Optional"}</small></span></span><i className={`fa-solid fa-chevron-${showExtras ? "up" : "down"}`} aria-hidden="true" /></button>
          {showExtras ? <div className="tp-booking-extras__list">{tour.details.booking.extras.map((extra) => <label key={extra.name}><input type="checkbox" checked={extra.required || Boolean(extras[extra.name])} disabled={extra.required} onChange={(event) => setExtras((current) => ({ ...current, [extra.name]: event.target.checked }))} /><span><strong>{extra.name}</strong><small>{extra.required ? "Required for every traveller" : "Add to this booking"}</small></span><b>+{money(extra.price, tour.currency)}</b></label>)}</div> : null}
        </section> : null}

        <section className="tp-booking-total">
          <header><div><small>Your trip total</small><strong>{travellers} {travellers === 1 ? "traveller" : "travellers"} selected</strong></div><span>Verified next</span></header>
          <dl><div><dt>Departure</dt><dd>{departure ? `${dateParts(departure.date).day} ${dateParts(departure.date).month}` : "Not selected"}</dd></div><div><dt>Room sharing</dt><dd>{labels[sharing].title.replace(" Sharing", "")} × {travellers}</dd></div><div><dt>Add-ons</dt><dd>{selectedExtras.length || "None"}</dd></div></dl>
          <div className="tp-booking-grand"><span>Estimated package amount<small>WordPress verifies the final fare</small></span><strong>{money(estimate, tour.currency)}</strong></div>
          {error ? <p className="tp-booking-error" role="alert">{error}</p> : null}
          <button type="submit" className="tp-booking-submit" disabled={isSubmitting || !departure}><span>{isSubmitting ? "Verifying your fare…" : "Continue to secure checkout"}</span><i className="fa-solid fa-arrow-right" /></button>
          <div className="tp-booking-assurance"><span>● Instant confirmation</span><span>● Secure payment</span></div>
        </section>
      </form>
    </aside>
  );
}
