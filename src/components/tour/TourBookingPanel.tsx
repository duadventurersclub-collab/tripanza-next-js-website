"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TourDetail } from "@/lib/wp";

type Sharing = "quad" | "triple" | "twin";

const sharingLabels: Record<Sharing, { title: string; occupancy: string }> = {
  quad: { title: "Quad Sharing", occupancy: "4 / room" },
  triple: { title: "Triple Sharing", occupancy: "3 / room" },
  twin: { title: "Twin Sharing", occupancy: "2 / room" },
};

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function dateParts(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { day: value, month: "" };
  return {
    day: parsed.toLocaleDateString("en-IN", { day: "2-digit" }),
    month: parsed.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
  };
}

export default function TourBookingPanel({ tour }: { tour: TourDetail }) {
  const options = (["quad", "triple", "twin"] as Sharing[]).filter((key) => Boolean(tour.details.pricing[key]));
  const [sharing, setSharing] = useState<Sharing>(options[0] || "quad");
  const [travellers, setTravellers] = useState(1);
  const [departureIndex, setDepartureIndex] = useState(0);
  const price = tour.details.pricing[sharing]?.amount || Number(tour.price.replace(/[^0-9.]/g, "")) || 0;
  const booking = tour.details.booking;

  const calculation = useMemo(() => {
    const perPersonDiscount = booking.discount_type === "percent"
      ? price * Math.min(100, booking.discount_rate) / 100
      : booking.discount_rate;
    const salePerPerson = Math.max(0, price - perPersonDiscount);
    const base = price * travellers;
    const sale = Math.max(0, perPersonDiscount * travellers);
    const matchingRule = tour.details.bulk_discounts
      .filter((rule) => rule.audience === sharing && travellers >= rule.from)
      .sort((a, b) => b.from - a.from)[0];
    const afterSale = Math.max(0, salePerPerson * travellers);
    const groupSaving = matchingRule
      ? matchingRule.type === "percent" ? afterSale * matchingRule.value / 100 : matchingRule.value
      : 0;
    const total = Math.max(0, afterSale - groupSaving);
    const payNow = total * booking.deposit_percentage / 100;
    return { base, sale, groupSaving, total, payNow, payLater: total - payNow };
  }, [booking, price, sharing, tour.details.bulk_discounts, travellers]);

  const departure = tour.details.departures[departureIndex];
  const nextRule = tour.details.bulk_discounts
    .filter((rule) => rule.audience === sharing && travellers < rule.from)
    .sort((a, b) => a.from - b.from)[0];
  const checkoutHref = `/booking?tour=${tour.id}${departure ? `&date=${encodeURIComponent(departure.date)}` : ""}&sharing=${sharing}&travellers=${travellers}`;

  return (
    <aside className="tp-tour-sidebar" aria-label="Book this tour" id="booking-request">
      <div className="tp-booking-panel">
        <header className="tp-booking-panel__intro">
          <span><i className="fa-solid fa-lock" aria-hidden="true" /></span>
          <div><small>Secure booking</small><strong>Plan your trip</strong></div>
        </header>

        {booking.discount_rate > 0 ? (
          <div className="tp-booking-benefits">
            <span><b>↓</b><small>You save</small><strong>{booking.discount_type === "amount" ? `${money(booking.discount_rate)} off` : `${booking.discount_rate}% off`}</strong></span>
            <span><i className="fa-solid fa-check" /> Takes 2 min</span>
          </div>
        ) : null}

        <ol className="tp-booking-progress" aria-label="Booking progress">
          {["Date", "Travellers", "Extras", "Payment"].map((label, index) => <li className={index < 3 ? "is-complete" : "is-active"} key={label}><span>{index < 3 ? "✓" : index + 1}</span><small>{label}</small></li>)}
        </ol>

        <section className="tp-booking-step">
          <header><span>01</span><div><strong>Select departure</strong><small>Choose the batch that works for you</small></div></header>
          {tour.details.departures.length ? (
            <div className="tp-booking-dates">
              {tour.details.departures.map((item, index) => {
                const parts = dateParts(item.date);
                return <button type="button" className={index === departureIndex ? "is-active" : ""} onClick={() => setDepartureIndex(index)} key={`${item.date}-${index}`}><strong>{parts.day}</strong><small>{parts.month}</small></button>;
              })}
            </div>
          ) : <p className="tp-booking-empty">Ask us for the next available departure.</p>}
          <div className="tp-booking-availability"><i /><span><strong>{departure?.status || "Availability being confirmed"}</strong><small>{departure ? "This departure is open for booking." : "Contact us if you need immediate assistance."}</small></span><b>{departure ? "Live" : "Checking"}</b></div>
        </section>

        <section className="tp-booking-step">
          <header><span>02</span><div><strong>Choose room sharing</strong><small>The package price is per traveller</small></div></header>
          <div className="tp-booking-sharing">
            {options.map((key) => <button type="button" className={key === sharing ? "is-active" : ""} onClick={() => setSharing(key)} key={key}><strong>{sharingLabels[key].title}</strong>{key === "triple" ? <em>Recommended</em> : null}<small>{sharingLabels[key].occupancy}</small></button>)}
          </div>
        </section>

        {nextRule ? (
          <div className="tp-booking-saving"><b>%</b><div><strong>Save {nextRule.type === "amount" ? money(nextRule.value) : `${nextRule.value}%`} as a group</strong><small>Add {nextRule.from - travellers} more traveller{nextRule.from - travellers === 1 ? "" : "s"} to unlock this saving.</small><span><i style={{ width: `${Math.min(100, travellers / nextRule.from * 100)}%` }} /></span></div></div>
        ) : calculation.groupSaving > 0 ? (
          <div className="tp-booking-saving is-unlocked"><b>%</b><div><strong>{money(calculation.groupSaving)} group saving unlocked</strong><small>You have unlocked this group booking offer.</small><span><i style={{ width: "100%" }} /></span></div></div>
        ) : null}

        <section className="tp-booking-step tp-booking-travellers">
          <header><span>03</span><div><strong>How many travellers?</strong><small>{sharingLabels[sharing].title} · {sharingLabels[sharing].occupancy}</small></div></header>
          <div className="tp-booking-counter"><button type="button" onClick={() => setTravellers((value) => Math.max(1, value - 1))} aria-label="Remove one traveller">−</button><strong>{travellers}</strong><button type="button" onClick={() => setTravellers((value) => Math.min(tour.details.capacity || 30, value + 1))} aria-label="Add one traveller">+</button></div>
        </section>

        <div className="tp-booking-price-card"><span><i className="fa-solid fa-check" />{sharingLabels[sharing].title}</span><strong>{booking.discount_rate > 0 ? <del>{money(price)}</del> : null}{money(Math.max(0, price - calculation.sale / travellers))}<small>Per person</small></strong></div>

        <section className="tp-booking-total">
          <header><div><small>Your trip total</small><strong>{travellers} traveller{travellers === 1 ? "" : "s"} selected</strong></div><span>Fare summary</span></header>
          <dl><div><dt>Package amount</dt><dd>{money(calculation.base)}</dd></div>{calculation.sale > 0 ? <div className="is-saving"><dt>Tripanza sale</dt><dd>− {money(calculation.sale)}</dd></div> : null}{calculation.groupSaving > 0 ? <div className="is-saving"><dt>Group discount</dt><dd>− {money(calculation.groupSaving)}</dd></div> : null}</dl>
          <div className="tp-booking-grand"><span>Total trip amount<small>Final amount for selected travellers</small></span><strong>{money(calculation.total)}</strong></div>
          <div className="tp-booking-payment-split"><span>Pay now<strong>{money(calculation.payNow)}</strong><small>Charged securely today</small></span>{calculation.payLater > 0 ? <span>Pay later<strong>{money(calculation.payLater)}</strong><small>Due before departure</small></span> : null}</div>
          <Link href={checkoutHref} className="tp-booking-submit"><span>{booking.deposit_percentage < 100 ? `Pay advance · ${money(calculation.payNow)}` : `Continue · ${money(calculation.total)}`}</span><i className="fa-solid fa-arrow-right" /></Link>
          <div className="tp-booking-assurance"><span>● Instant confirmation</span><span>● Human support</span></div>
        </section>
      </div>
    </aside>
  );
}
