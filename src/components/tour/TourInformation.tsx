"use client";

import { useEffect, useRef, useState } from "react";
import type { TourDetail, TourAvailabilityBatch } from "@/lib/wp";
import { formatTourDate, formatTourDateWithOrdinal } from "@/lib/tour-date";

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
  return formatTourDate(dateStr, { month: "short", year: "numeric" }) || "All";
}

export default function TourInformation({ tour, availabilityBatches, whatsappUrl }: TourInformationProps) {
  const details = tour.details;
  const pricing = details.pricing;
  const formatPrice = (amount: number) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: pricing.currency || tour.currency || "INR", maximumFractionDigits: 0,
  }).format(amount);
  const [activeMonth, setActiveMonth] = useState("All");
  const [pdfStatus, setPdfStatus] = useState<"idle" | "preparing" | "started">("idle");
  const pdfFrameRef = useRef<HTMLIFrameElement>(null);
  const pdfTimerRef = useRef<number | null>(null);
  const hasPricing = Boolean(pricing.quad || pricing.triple || pricing.twin);

  const itineraryPdfUrl = (() => {
    try {
      const url = new URL(tour.link || `https://tripanza.com/tour/${tour.slug}/`);
      url.searchParams.set("generate_pdf", "1");
      url.searchParams.set("pdf_ready", "1");
      return url.toString();
    } catch {
      return `https://tripanza.com/tour/${encodeURIComponent(tour.slug)}/?generate_pdf=1&pdf_ready=1`;
    }
  })();

  function openBooking() {
    window.dispatchEvent(new Event("tripanza:open-booking"));
    document.getElementById("booking-request")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => () => {
    if (pdfTimerRef.current) window.clearTimeout(pdfTimerRef.current);
  }, []);

  function downloadItinerary() {
    if (pdfTimerRef.current) window.clearTimeout(pdfTimerRef.current);
    setPdfStatus("preparing");
    if (pdfFrameRef.current) pdfFrameRef.current.src = itineraryPdfUrl;
    pdfTimerRef.current = window.setTimeout(() => setPdfStatus("started"), 4500);
  }

  function closePdfStatus() {
    if (pdfTimerRef.current) window.clearTimeout(pdfTimerRef.current);
    pdfTimerRef.current = null;
    setPdfStatus("idle");
  }

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
    <div className="tp-tour-information" id="tp-trip-dates">
      <header className="tp-app-section-heading"><span>MAKE IT HAPPEN</span><h2>Your dates. Your escape.</h2><p>Find a departure and room sharing that work for you.</p></header>
      {/* Stats Row */}
      <div className="tp-info-stats">
        {details.duration.days && <div className="tp-info-stat">
          <div className="tp-info-stat__icon">
            <i className="fa-solid fa-clock" aria-hidden="true" />
          </div>
          <span>
            <small>Duration</small>
            <strong>{details.duration.days}D / {details.duration.nights}N</strong>
          </span>
        </div>}
        {details.capacity > 0 && <div className="tp-info-stat">
          <div className="tp-info-stat__icon">
            <i className="fa-solid fa-users" aria-hidden="true" />
          </div>
          <span>
            <small>Group Size</small>
            <strong>Up to {details.capacity} people</strong>
          </span>
        </div>}
        <div className="tp-info-stat">
          <div className="tp-info-stat__icon">
            <i className="fa-solid fa-user-shield" aria-hidden="true" />
          </div>
          <span>
            <small>Trip captains</small>
            <strong>Verified team</strong>
          </span>
        </div>
        <div className="tp-info-stat">
          <div className="tp-info-stat__icon">
            <i className="fa-solid fa-credit-card" aria-hidden="true" />
          </div>
          <span>
            <small>Payment</small>
            <strong>Advance &amp; EMI</strong>
          </span>
        </div>
      </div>

      <div className="tp-info-promise">
        <span className="tp-info-promise__icon"><i className="fa-solid fa-shield-heart" aria-hidden="true" /></span>
        <span>
          <strong>Tripanza promise</strong>
          <small>Get what was promised, or let our support team make it right.</small>
        </span>
      </div>

      {/* Price Grid */}
      {hasPricing && <div className="tp-info-prices">
        {pricing.quad && (
          <div>
            <div className="tp-info-price__label">Quad</div>
            <div>
              <span className="price-amount">{formatPrice(pricing.quad.amount)}</span>
              <small>per person · 4 / room</small>
            </div>
          </div>
        )}
        {pricing.triple && (
          <div>
            <div className="tp-info-price__label">Triple</div>
            <div>
              <span className="price-amount">{formatPrice(pricing.triple.amount)}</span>
              <small>per person · 3 / room</small>
            </div>
          </div>
        )}
        {pricing.twin && (
          <div>
            <div className="tp-info-price__label">Twin</div>
            <div>
              <span className="price-amount">{formatPrice(pricing.twin.amount)}</span>
              <small>per person · 2 / room</small>
            </div>
          </div>
        )}
      </div>}

      <aside className="tp-responsible-note" aria-label="Responsible travel reminder">
        <i className="fa-solid fa-seedling" aria-hidden="true" />
        <p><strong>Travel responsibly</strong>Respect local communities, keep destinations clean and maintain civic sense.</p>
      </aside>

      {/* Availability / Departure Dates */}
      <div className="tp-info-availability" id="tp-info-availability">
        <div className="tp-info-section-head">
          <div className="tp-info-section-head__icon">
            <i className="fa-solid fa-calendar-check" aria-hidden="true" />
          </div>
          <span>
            <small>Available departures</small>
            <h2>Upcoming batches</h2>
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
                      {dep.check_in_formatted ? formatTourDateWithOrdinal(dep.check_in_formatted) : "Upcoming Batch"}
                    </div>
                    {dep.check_out_formatted && (
                      <div className="tp-date-sub">Return: {formatTourDate(dep.check_out_formatted, { day: "numeric", month: "long", year: "numeric" })}</div>
                    )}
                    {isPromoted && dep.benefit && (
                      <span className="tp-info-date__benefit">{dep.benefit}</span>
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
        <button
          type="button"
          className={`tp-info-download${pdfStatus === "preparing" ? " is-preparing" : ""}`}
          aria-busy={pdfStatus === "preparing"}
          onClick={downloadItinerary}
        >
          <i className={`fa-solid ${pdfStatus === "preparing" ? "fa-spinner fa-spin" : "fa-download"}`} aria-hidden="true" />
          {pdfStatus === "preparing" ? "Preparing…" : "Download PDF"}
        </button>
      </div>

      <iframe ref={pdfFrameRef} title="Itinerary PDF download" className="tp-pdf-download-frame" />

      {pdfStatus !== "idle" ? (
        <div className="tp-pdf-status" role="dialog" aria-modal="true" aria-labelledby="tp-pdf-status-title">
          <button type="button" className="tp-pdf-status__backdrop" onClick={closePdfStatus} aria-label="Close download status" />
          <div className={`tp-pdf-status__card${pdfStatus === "started" ? " is-started" : ""}`}>
            <button type="button" className="tp-pdf-status__close" onClick={closePdfStatus} aria-label="Close">×</button>
            <span className="tp-pdf-status__visual" aria-hidden="true">
              {pdfStatus === "started" ? <b>✓</b> : <><i>↗</i><em /></>}
            </span>
            <span className="tp-pdf-status__eyebrow">Tripanza · Your trip, sorted</span>
            <h2 id="tp-pdf-status-title">{pdfStatus === "started" ? "Download started" : "Packing your itinerary"}</h2>
            <p>{pdfStatus === "started" ? "Check your browser downloads. Your day-by-day trip plan is ready for offline use." : "We’re preparing the latest itinerary, stays and trip details. This usually takes a few seconds."}</p>
            {pdfStatus === "preparing" ? <span className="tp-pdf-status__progress"><i /></span> : null}
            {pdfStatus === "started" ? <button type="button" className="tp-pdf-status__done" onClick={closePdfStatus}>Done</button> : null}
            <a href={itineraryPdfUrl} target="_blank" rel="noopener noreferrer">Download not starting? Open PDF</a>
          </div>
        </div>
      ) : null}

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
        <button
          type="button"
          onClick={openBooking}
          style={{
            display: "flex",
            width: "100%",
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
            border: 0,
            cursor: "pointer",
          }}
        >
          <i className="fa-solid fa-bolt" aria-hidden="true" />
          Book My Seat — {pricing.starting_price || tour.price}
        </button>
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
