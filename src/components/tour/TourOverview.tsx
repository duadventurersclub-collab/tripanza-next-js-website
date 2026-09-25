"use client";

import Image from "next/image";
import { useState } from "react";
import type { TourDetail } from "@/lib/wp";
import { formatTourDate } from "@/lib/tour-date";
import TourAiChat from "@/components/tour/TourAiChat";

interface TourOverviewProps {
  tour: TourDetail;
  whatsappUrl: string;
}

function OrganizerAvatar({ name, url }: { name: string; url: string }) {
  const [mode, setMode] = useState<"optimized" | "direct" | "fallback">("optimized");
  const [loaded, setLoaded] = useState(false);

  return (
    <span className="organizer-avatar organizer-avatar--fallback" role="img" aria-label={`${name} logo`}>
      <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "T"}</span>
      {url && mode !== "fallback" && (
        <Image
          className={`organizer-avatar__image${loaded ? " is-loaded" : ""}`}
          src={url}
          alt=""
          width={56}
          height={56}
          sizes="56px"
          unoptimized={mode === "direct"}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setMode(mode === "optimized" ? "direct" : "fallback");
          }}
        />
      )}
    </span>
  );
}

export default function TourOverview({ tour, whatsappUrl }: TourOverviewProps) {
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

      <TourAiChat tour={tour} whatsappUrl={whatsappUrl} />

      {/* Organizer Card */}
      <div className="tp-organizer-card">
        <div className="tp-organizer-card__profile">
          <OrganizerAvatar key={partner.logo_url} name={organizerName} url={partner.logo_url} />
          <div className="organizer-info">
            <small>Experience organized by</small>
            <div className="tp-organizer-card__name">
              <strong>{organizerName}</strong>
            </div>
            <div className="partner-meta">
              {partner.rating > 0 && <span><i aria-hidden="true">★</i> {partner.rating.toFixed(1)} rating</span>}
              {partner.trip_count > 0 && <span>{partner.trip_count}+ trips hosted</span>}
            </div>
          </div>
        </div>

        {(partner.verified || partner.instagram_url) && (
          <div className="tp-organizer-card__aside">
            {partner.verified && <span className="trusted-partner-badge">✓ Verified organizer</span>}
            {partner.instagram_url && (
              <a
                href={partner.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="organizer-social"
                aria-label={`${organizerName} Instagram`}
              >
                Instagram <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        )}

        <div className="tp-trust-line">
          <span aria-hidden="true">✓</span>
          <p>
            <strong>Book with Tripanza protection</strong>
            Pay only through Tripanza to keep your booking and payment support protected.
          </p>
        </div>
      </div>
    </div>
  );
}
