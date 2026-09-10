"use client";

import { useState } from "react";
import type { TourDetail, TourAvailabilityBatch } from "@/lib/wp";
import Link from "next/link";

interface TourInformationProps {
  tour: TourDetail;
  availabilityBatches: TourAvailabilityBatch[];
  whatsappUrl: string;
}

function getBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("fast") || s.includes("filling")) return "tp-badge tp-badge-urgent";
  if (s.includes("sold") || s.includes("full")) return "tp-badge tp-badge-danger";
  if (s.includes("available") || s.includes("open")) return "tp-badge tp-badge-success";
  if (s.includes("last")) return "tp-badge tp-badge-warning";
  return "tp-badge tp-badge-neutral";
}

function getMonthLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
  } catch {
    return "All";
  }
}

export default function TourInformation({ tour, availabilityBatches, whatsappUrl }: TourInformationProps) {
  const details = tour.details;
  const pricing = details.pricing;
  const [activeMonth, setActiveMonth] = useState("All");

  // Build month filter list from batches
  const months = ["All"];
  availabilityBatches.forEach((b) => {
    if (b.check_in_formatted) {
      const m = getMonthLabel(b.check_in_formatted);
      if (!months.includes(m)) months.push(m);
    }
  });

  const filteredBatches = activeMonth === "All"
    ? availabilityBatches
    : availabilityBatches.filter((b) => b.check_in_formatted && getMonthLabel(b.check_in_formatted) === activeMonth);

  const departuresToShow = filteredBatches.length > 0 ? filteredBatches : details.departures.map((d) => ({
    check_in: 0,
    check_out: 0,
    adult_price: "",
    child_price: "",
    infant_price: "",
    status: d.status,
    promoted: d.promoted,
    badge: d.badge || undefined,
    check_in_formatted: d.date,
    check_out_formatted: d.check_out,
    benefit: d.benefit || undefined,
  }));

  return (
    <div className="tp-tour-information">
      {/* Stats Row */}
      <div className="tp-info-stats">
        <div className="tp-info-stat">
          <div className="tp-info-stat__icon">
            <i className="fa-solid fa-clock" aria-hidden="true" />
          </div>
          <span>
            <small>Duration</small>
            <strong>{details.duration.days}D / {details.duration.nights}N</strong>
          </span>
        </div>
        <div className="tp-info-stat">
          <div className="tp-info-stat__icon">
            <i className="fa-solid fa-users" aria-hidden="true" />
          </div>
          <span>
            <small>Group Size</small>
            <strong>Upto {details.capacity} people</strong>
          </span>
        </div>
        <div className="tp-info-stat">
          <div className="tp-info-stat__icon">
            <i className="fa-solid fa-location-dot" aria-hidden="true" />
          </div>
          <span>
            <small>Destination</small>
            <strong>{details.destination}</strong>
          </span>
        </div>
        <div className="tp-info-stat">
          <div className="tp-info-stat__icon">
            <i className="fa-solid fa-star" aria-hidden="true" />
          </div>
          <span>
            <small>Rating</small>
            <strong>{details.rating.value.toFixed(1)} / 5 ({details.rating.count})</strong>
          </span>
        </div>
      </div>

      {/* Cancellation Promise */}
      <div className="tp-info-promise">
        <div className="tp-info-promise__icon">
          <i className="fa-solid fa-shield-check" aria-hidden="true" />
        </div>
        <span>
          <strong>Free Cancellation — No risk booking</strong>
          <small>Cancel before 7 days of departure for a full refund. No questions asked.</small>
        </span>
      </div>

      {/* Price Grid */}
      <div className="tp-info-prices">
        {pricing.quad && (
          <div>
            <div className="tp-info-price__label">Quad</div>
            <div>
              <span className="price-amount">{pricing.quad.display}</span>
              <small>4 in 1 room</small>
            </div>
          </div>
        )}
        {pricing.triple && (
          <div>
            <div className="tp-info-price__label">Triple</div>
            <div>
              <span className="price-amount">{pricing.triple.display}</span>
              <small>3 in 1 room</small>
            </div>
          </div>
        )}
        {pricing.twin && (
          <div>
            <div className="tp-info-price__label">Twin</div>
            <div>
              <span className="price-amount">{pricing.twin.display}</span>
              <small>2 in 1 room</small>
            </div>
          </div>
        )}
      </div>

      {/* Token deposit CTA */}
      <div className="tp-info-civic">
        <span>
          <i className="fa-solid fa-bolt" aria-hidden="true" />
        </span>
        <p>
          <strong>Secure your seat with just ₹2,000</strong>
          <small>Pay the token now, balance amount due before departure day.</small>
        </p>
      </div>

      {/* Availability / Departure Dates */}
      <div className="tp-info-availability">
        <div className="tp-info-section-head">
          <div className="tp-info-section-head__icon">
            <i className="fa-solid fa-calendar-check" aria-hidden="true" />
          </div>
          <span>
            <small>Live Departures</small>
            <h2>Choose Your Travel Dates</h2>
          </span>
        </div>

        {/* Month Filter Tabs */}
        <div className="tp-info-months" role="group" aria-label="Filter by month">
          {months.map((m) => (
            <button
              key={m}
              type="button"
              className={`tp-adv-filter-btn${activeMonth === m ? " active" : ""}`}
              aria-pressed={activeMonth === m}
              onClick={() => setActiveMonth(m)}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Date Cards */}
        <div className="tp-info-date-list">
          {departuresToShow.length > 0 ? (
            departuresToShow.map((dep, idx) => {
              const isPromoted = dep.promoted ?? false;
              return (
                <div
                  key={idx}
                  className={`tp-info-date${isPromoted ? " is-promoted" : ""}`}
                >
                  <div className="tp-info-date__calendar">
                    <i className="fa-solid fa-calendar" aria-hidden="true" />
                  </div>
                  <div className="tp-date-left">
                    {isPromoted && dep.badge && (
                      <span className="tp-info-date__promotion">{dep.badge}</span>
                    )}
                    <div className="tp-date-main">
                      {dep.check_in_formatted || "Upcoming Batch"}
                    </div>
                    {dep.check_out_formatted && (
                      <div className="tp-date-sub">Return: {dep.check_out_formatted}</div>
                    )}
                    {isPromoted && (dep as any).benefit && (
                      <span className="tp-info-date__benefit">{(dep as any).benefit}</span>
                    )}
                  </div>
                  <div className="tp-date-right">
                    <span className={getBadgeClass(dep.status)}>
                      <i />
                      {dep.status || "Available"}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "16px", color: "#697386", fontSize: "12px", textAlign: "center" }}>
              <i className="fa-solid fa-calendar-xmark" style={{ marginRight: 8, color: "#3157d5" }} aria-hidden="true" />
              No upcoming batches. <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#3157d5", fontWeight: 800 }}>Chat with us</a> for custom dates.
            </div>
          )}
        </div>

        <p className="tp-info-disclaimer">
          <i className="fa-solid fa-circle-info" aria-hidden="true" style={{ color: "#3157d5" }} />
          Prices shown are per person on quad sharing basis. Final price varies by sharing type.
        </p>
      </div>

      {/* Itinerary Download CTA */}
      <div className="tp-info-itinerary-card">
        <div className="tp-info-itinerary-card__icon">
          <i className="fa-solid fa-file-pdf" aria-hidden="true" />
        </div>
        <div>
          <h2>Take the itinerary with you</h2>
          <p>Download a detailed day-by-day PDF for offline reference before departure.</p>
        </div>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tp-info-download"
        >
          <i className="fa-solid fa-download" aria-hidden="true" />
          Get PDF
        </a>
      </div>

      {/* Book Seat CTA Block */}
      <div style={{
        display: "grid",
        gap: 8,
        padding: "20px",
        border: "1px solid #e2e7f0",
        borderRadius: 20,
        background: "#fff",
        boxShadow: "0 10px 30px rgba(27,35,64,.05)"
      }}>
        <Link
          href={`/booking?tour=${tour.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "15px 24px",
            borderRadius: 15,
            color: "#171923",
            background: "#d0e562",
            fontWeight: 900,
            fontSize: 14,
            textDecoration: "none",
            boxShadow: "0 8px 20px rgba(170,200,0,.25)",
          }}
        >
          <i className="fa-solid fa-bolt" aria-hidden="true" />
          Book My Seat — {pricing.starting_price || tour.price}
        </Link>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "13px 24px",
            borderRadius: 15,
            color: "#171923",
            background: "#f7f9fd",
            border: "1px solid #e2e7f0",
            fontWeight: 800,
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          <i className="fa-brands fa-whatsapp" style={{ color: "#25d366", fontSize: 16 }} aria-hidden="true" />
          Chat with Trip Coordinator
        </a>
        <div style={{ paddingTop: 10, borderTop: "1px solid #e8ebf1", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {["Instant confirmation", "Same-gender roommates", "24/7 support"].map((t) => (
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 8px", borderRadius: 9, color: "#3157d5", background: "#edf2ff", fontSize: 9, fontWeight: 800 }}>
              <i className="fa-solid fa-check" aria-hidden="true" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
