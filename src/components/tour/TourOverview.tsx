"use client";

import Image from "next/image";
import { useState } from "react";
import type { TourDetail } from "@/lib/wp";
import { formatTourDate } from "@/lib/tour-date";

interface TourOverviewProps {
  tour: TourDetail;
}

function OrganizerAvatar({ name, url }: { name: string; url: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imageUrl = url.replace(/Tripanza-Logo-3\.png(?=\?|$)/, "Tripanza-Logo-3-150x150.png");

  return (
    <span className="organizer-avatar organizer-avatar--fallback" role="img" aria-label={`${name} logo`}>
      <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "T"}</span>
      {url && !failed && (
        <Image
          className={`organizer-avatar__image${loaded ? " is-loaded" : ""}`}
          src={imageUrl}
          alt=""
          width={52}
          height={52}
          sizes="52px"
          unoptimized
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setFailed(true);
          }}
        />
      )}
    </span>
  );
}

export default function TourOverview({ tour }: TourOverviewProps) {
  const details = tour.details;
  const partner = details.partner;
  const organizerName = partner.name?.trim() || "Tour organizer";
  const pricing = details.pricing;
  const includedText = details.included.join(" ");
  const hotelNights = Number(includedText.match(/(\d+)\s*night/i)?.[1] || 0);
  const mealCount = Array.from(includedText.matchAll(/(\d+)\s*(?:breakfast|dinner|lunch|meal)/gi))
    .reduce((total, match) => total + Number(match[1] || 0), 0);
  const hasTransport = /\bac\b.*(?:travel|transport|bus)|(?:travel|transport|bus).*\bac\b/i.test(includedText);
  const hasCaptain = /captain|coordinator/i.test(includedText);
  const nextDeparture = details.departures[0]?.date;
  const nextDepartureLabel = nextDeparture
    ? formatTourDate(nextDeparture, { day: "numeric", month: "long" })
    : "";
  const cashbackAmount = Number((details.cashback || "").replace(/[^0-9.-]/g, ""));
  const hasCashback = Number.isFinite(cashbackAmount) && cashbackAmount > 0;
  const cashbackLabel = details.cashback && /off|cashback/i.test(details.cashback)
    ? details.cashback
    : details.cashback ? `Flat ${details.cashback} OFF via cashback` : "";

  return (
    <div className="tp-tour-overview" id="tp-trip-overview">
      {/* Header Card */}
      <header className="tp-tour-overview__header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Premium Badge */}
          {details.is_premium && (
            <div className="tp-tour-overview__premium">
              <i className="fa-solid fa-crown" aria-hidden="true" />
              Premium Experience
            </div>
          )}

          <div className="tp-app-overline"><span>YOUR NEXT MAIN-CHARACTER MOMENT</span>{details.rating.count > 0 && <span><i className="fa-solid fa-star" aria-hidden="true" /> {details.rating.value.toFixed(1)} <small>({details.rating.count} reviews)</small></span>}</div>
          <h1 className="tp-tour-overview__title">{tour.title}</h1>

          {/* Value Summary Card */}
          <div className="tp-value-card">
            <div className="tp-value-card__copy">
              <small>Your trip at a glance</small>
              <div className="tp-value-summary">
                {details.duration.days && (
                  <span>
                    <i className="fa-solid fa-calendar-days" aria-hidden="true" style={{ marginRight: 5, color: "#3157d5", fontSize: 9 }} />
                    {details.duration.days}D / {details.duration.nights}N
                  </span>
                )}
                {hotelNights > 0 && (
                  <span>
                    <i className="fa-solid fa-hotel" aria-hidden="true" style={{ marginRight: 5, color: "#3157d5", fontSize: 9 }} />
                    {hotelNights} hotel {hotelNights === 1 ? "night" : "nights"}
                  </span>
                )}
                {mealCount > 0 && (
                  <span>
                    <i className="fa-solid fa-utensils" aria-hidden="true" style={{ marginRight: 5, color: "#3157d5", fontSize: 9 }} />
                    {mealCount} meals
                  </span>
                )}
                {hasTransport && (
                  <span>
                    <i className="fa-solid fa-bus" aria-hidden="true" style={{ marginRight: 5, color: "#3157d5", fontSize: 9 }} />
                    AC transport
                  </span>
                )}
                {hasCaptain && (
                  <span>
                    <i className="fa-solid fa-user-shield" aria-hidden="true" style={{ marginRight: 5, color: "#3157d5", fontSize: 9 }} />
                    Trip captain
                  </span>
                )}
              </div>
            </div>

            <div className="tp-value-price">
              <small>Starting from</small>
              <div className="tp-value-price__amount">
                <span className="price-value">{pricing.starting_price || tour.price || "Contact us"}</span>
              </div>
              <span>per person</span>
            </div>
          </div>

          {/* Primary overview links */}
          <div className="tp-overview-conversion">
            <div className="tp-overview-actions">
              <a href="#tp-info-availability" className="tp-overview-cta tp-overview-cta--primary">
                <i className="fa-solid fa-calendar-check" aria-hidden="true" />
                Check available dates
              </a>
              <a href="#tp-trip-cover" className="tp-overview-cta tp-overview-cta--secondary">
                <i className="fa-solid fa-list-check" aria-hidden="true" />
                See what&apos;s included
              </a>
            </div>
            {(nextDeparture || details.seats_left) && (
              <div className="tp-live-proof">
                <span className="tp-live-proof__pulse" />
                <strong>{nextDepartureLabel ? `Next departure ${nextDepartureLabel}` : details.seats_left}</strong>
              </div>
            )}
          </div>

          {/* Cashback Offer */}
          {hasCashback && (
            <div className="tp-tour-offer">
              <div className="tp-tour-offer__icon">
                <i className="fa-solid fa-tag" aria-hidden="true" />
              </div>
              <div className="tp-tour-offer__content">
                <strong>{cashbackLabel}</strong>
                <small>Available on eligible bookings</small>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Route / Direction Box */}
      {(details.origin || details.destination) && <div className="tp-route-box">
        <div className="tp-route-city">
          <div className="tp-route-city__icon">
            <i className="fa-solid fa-bus-simple" aria-hidden="true" />
          </div>
          <span>
            <small>Starts From</small>
            <strong>{details.origin}</strong>
          </span>
        </div>
        <div className="tp-route-direction" aria-hidden="true">
          <i className="fa-solid fa-arrow-right" />
        </div>
        <div className="tp-route-city tp-route-city--destination">
          <div className="tp-route-city__icon">
            <i className="fa-solid fa-mountain" aria-hidden="true" />
          </div>
          <span>
            <small>Travelling To</small>
            <strong>{details.destination}</strong>
          </span>
        </div>
      </div>}

      {/* Organizer Card */}
      <div className="tp-organizer-card">
        <div className="tp-organizer-card__profile">
          <OrganizerAvatar key={partner.logo_url} name={organizerName} url={partner.logo_url} />
          <div className="organizer-info">
            <small>Experience organized by</small>
            <div className="tp-organizer-card__name">
              <strong>{organizerName}</strong>
              {partner.verified && <span className="tp-verified" aria-label="Verified organizer">✓</span>}
            </div>
            <div className="partner-meta">
              {partner.rating > 0 && <span><i aria-hidden="true">★</i>{partner.rating.toFixed(1)} rating</span>}
              {partner.trip_count > 0 && <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 12h16" /></svg>{partner.trip_count} trips</span>}
            </div>
          </div>
        </div>

        {(partner.verified || partner.instagram_url) && (
          <div className="tp-organizer-card__aside">
            {partner.verified && <span className="trusted-partner-badge"><span aria-hidden="true">✓</span>Trusted partner</span>}
            {partner.instagram_url && (
              <a
                href={partner.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="organizer-social"
                aria-label={`${organizerName} Instagram`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
              </a>
            )}
          </div>
        )}

        <div className="tp-trust-line">
          <span aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2ZM10 6a2 2 0 0 1 4 0v2h-4V6Z" /></svg></span>
          <p>
            <strong>Book with Tripanza protection</strong>
            Pay only through Tripanza to keep your booking and payment support protected.
          </p>
        </div>
      </div>
    </div>
  );
}
