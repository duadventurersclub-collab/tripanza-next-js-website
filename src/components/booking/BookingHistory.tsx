"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { UserBooking } from "@/lib/wp";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function LocationIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4zM8 4v6M16 4v6M4 11h16" /></svg>;
}

function InvoiceIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6zM14 3v4h4M9 12h6M9 16h6" /></svg>;
}

export default function BookingHistory({ bookings }: { bookings: UserBooking[] }) {
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const upcoming = bookings.filter((booking) => booking.timing === "upcoming").length;
  const visible = filter === "all" ? bookings : bookings.filter((booking) => booking.timing === filter);

  return <section className="tp-bookings" aria-label="Your Tripanza bookings">
    <header className="tp-bookings-intro">
      <div><span>TRIP CONTROL</span><h1>Your escapes.<br /><em>All sorted.</em></h1></div>
      <div className="tp-bookings-count"><strong>{bookings.length}</strong><small>Bookings</small></div>
    </header>

    {bookings.length ? <>
      <nav className="tp-bookings-filters" aria-label="Filter bookings">
        {([['all', bookings.length], ['upcoming', upcoming], ['past', bookings.length - upcoming]] as const).map(([name, count]) => <button type="button" key={name} className={filter === name ? "is-active" : ""} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name[0].toUpperCase() + name.slice(1)} <span>{count}</span></button>)}
      </nav>

      {visible.length ? <div className="tp-bookings-list">{visible.map((booking) => <article className="tp-booking-card" key={booking.id}>
        <div className="tp-booking-media">
          <Image src={booking.image} alt={booking.title} fill sizes="(min-width: 680px) 245px, 100vw" unoptimized />
          <span className={`tp-booking-status is-${booking.status_tone}`}>{booking.status}</span>
          <span className="tp-booking-date"><small>{booking.timing === "upcoming" ? "NEXT UP" : "TRIP DATE"}</small>{booking.check_in}</span>
        </div>
        <div className="tp-booking-main">
          <div className="tp-booking-title-row"><div><span className="tp-booking-kicker">{booking.timing === "upcoming" ? "CREW LOADING" : "TRIP MEMORY"}</span><h2>{booking.title}</h2></div><span className="tp-booking-number">#{booking.booking_number}</span></div>
          <div className="tp-booking-meta">{booking.location ? <span><LocationIcon />{booking.location}</span> : null}<span><CalendarIcon />{booking.duration}</span></div>
          <div className="tp-booking-payment">
            <div><small>Trip total</small><strong>{money(booking.total, booking.currency)}</strong></div>
            <div><small>Paid</small><strong>{money(booking.paid, booking.currency)}</strong></div>
            <div className={booking.remaining > 0 ? "has-due" : "is-clear"}><small>{booking.remaining > 0 ? "Still due" : "Payment"}</small><strong>{booking.remaining > 0 ? money(booking.remaining, booking.currency) : "All clear ✓"}</strong></div>
          </div>
          <div className="tp-booking-actions">
            {booking.invoice_url ? <a href={booking.invoice_url} className="tp-booking-invoice" target="_blank" rel="noopener noreferrer"><InvoiceIcon />Invoice</a> : <span className="tp-booking-invoice is-disabled"><InvoiceIcon />Invoice</span>}
            {booking.details_url ? <a href={booking.details_url} className="tp-booking-details">Open booking <span aria-hidden="true">→</span></a> : booking.tour_slug ? <Link href={`/tours/${booking.tour_slug}`} className="tp-booking-details">View trip <span aria-hidden="true">→</span></Link> : null}
          </div>
        </div>
      </article>)}</div> : <div className="tp-bookings-filter-empty">Nothing in this trip lane yet.</div>}
    </> : <div className="tp-bookings-empty"><span aria-hidden="true">✈</span><small>YOUR TRIPS</small><h2>No trips yet.<br /><em>Let&apos;s fix that.</em></h2><p>Pick a date, meet your crew and give this screen something to flex.</p><Link className="tp-bookings-login" href="/tours">Explore trips <b aria-hidden="true">→</b></Link></div>}
  </section>;
}
