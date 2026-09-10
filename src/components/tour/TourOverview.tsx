import Link from "next/link";
import type { TourDetail } from "@/lib/wp";

interface TourOverviewProps {
  tour: TourDetail;
  whatsappUrl: string;
}

export default function TourOverview({ tour, whatsappUrl }: TourOverviewProps) {
  const details = tour.details;
  const partner = details.partner;
  const pricing = details.pricing;
  const reels = details.reels;

  return (
    <div className="tp-tour-overview">
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

          <h1 className="tp-tour-overview__title">{tour.title}</h1>

          {/* Value Summary Card */}
          <div className="tp-value-card">
            <div className="tp-value-card__copy">
              <small>Trip overview</small>
              <div className="tp-value-summary">
                <span>
                  <i className="fa-solid fa-calendar-days" aria-hidden="true" style={{ marginRight: 5, color: "#3157d5", fontSize: 9 }} />
                  {details.duration.days}D / {details.duration.nights}N
                </span>
                <span>
                  <i className="fa-solid fa-location-dot" aria-hidden="true" style={{ marginRight: 5, color: "#3157d5", fontSize: 9 }} />
                  {details.destination}
                </span>
                <span>
                  <i className="fa-solid fa-users" aria-hidden="true" style={{ marginRight: 5, color: "#3157d5", fontSize: 9 }} />
                  Upto {details.capacity} People
                </span>
                {details.rating.value > 0 && (
                  <span>
                    <i className="fa-solid fa-star" aria-hidden="true" style={{ marginRight: 4, color: "#e5a309", fontSize: 9 }} />
                    {details.rating.value.toFixed(1)} ({details.rating.count} reviews)
                  </span>
                )}
              </div>
            </div>

            <div className="tp-value-price">
              <small>Starting at</small>
              <div className="tp-value-price__amount">
                <span className="price-value">{pricing.starting_price || tour.price}</span>
              </div>
              <span>per person + 5% GST</span>
            </div>
          </div>

          {/* Live Proof & CTA */}
          <div className="tp-overview-conversion">
            {details.seats_left && (
              <div className="tp-live-proof">
                <span className="tp-live-proof__pulse" />
                <strong>{details.seats_left}</strong>
                <span className="is-urgent">Hurry up!</span>
              </div>
            )}
            <div className="tp-overview-actions">
              <Link href={`/booking?tour=${tour.id}`} className="tp-overview-cta tp-overview-cta--primary">
                <i className="fa-solid fa-bolt" aria-hidden="true" />
                Book My Seat
              </Link>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="tp-overview-cta tp-overview-cta--secondary">
                <i className="fa-brands fa-whatsapp" aria-hidden="true" style={{ color: "#25d366" }} />
                WhatsApp
              </a>
            </div>
          </div>

          {/* Cashback Offer */}
          {details.cashback && (
            <div className="tp-tour-offer">
              <div className="tp-tour-offer__icon">
                <i className="fa-solid fa-tag" aria-hidden="true" />
              </div>
              <div className="tp-tour-offer__content">
                <strong>{details.cashback} on this booking</strong>
                <small>Applied automatically at checkout — no coupon needed</small>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Route / Direction Box */}
      <div className="tp-route-box">
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
          <i className="fa-solid fa-location-arrow" />
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
      </div>

      {/* AI Assistant */}
      <div className="tp-tour-assistant">
        <div className="tp-tour-assistant__mark">
          <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
        </div>
        <textarea
          placeholder={`Ask me anything about ${tour.title}…`}
          rows={1}
          readOnly
          onClick={() => window.open(whatsappUrl, "_blank")}
          style={{ cursor: "pointer" }}
        />
        <button type="button" aria-label="Ask question" onClick={() => window.open(whatsappUrl, "_blank")}>
          <i className="fa-solid fa-arrow-up" aria-hidden="true" />
        </button>
      </div>

      {/* Reels Shelf */}
      {reels.length > 0 && (
        <div className="tp-reel-shelf">
          <div className="tp-reel-shelf__head">
            <div>
              <small>Trip vibes</small>
              <h2>See it before you live it</h2>
            </div>
            <a href={`/tour-reels/?t=${tour.id}`} aria-label="Watch all reels">
              <i className="fa-solid fa-play" aria-hidden="true" />
              See all reels
            </a>
          </div>
          <div className="tp-reel-shelf__track">
            {reels.slice(0, 5).map((reel, i) => (
              <a
                key={i}
                className="tp-reel-card"
                href={`/tour-reels/?t=${tour.id}&r=${i}`}
                aria-label={`Watch reel ${i + 1}`}
              >
                <video
                  muted
                  loop
                  playsInline
                  preload="none"
                  poster={tour.featured_image || ""}
                  data-src={reel}
                  aria-hidden="true"
                />
                <span className="tp-reel-card__play" aria-hidden="true">
                  <i className="fa-solid fa-play" />
                </span>
                <div className="tp-reel-card__label">
                  <strong>{tour.title}</strong>
                  <small>Reel {i + 1}</small>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* In-page Nav Links */}
      <nav className="tp-overview-itinerary-nav" aria-label="Tour sections">
        <a href="#tp-trip-days">
          <i className="fa-solid fa-route" aria-hidden="true" />
          Itinerary
        </a>
        <a href="#tp-trip-highlights">
          <i className="fa-solid fa-sparkles" aria-hidden="true" />
          Highlights
        </a>
        <a href="#tp-trip-stays">
          <i className="fa-solid fa-bed" aria-hidden="true" />
          Stays
        </a>
        <a href="#tp-trip-cover">
          <i className="fa-solid fa-check-circle" aria-hidden="true" />
          Inclusions
        </a>
        <a href="#tp-trip-faq">
          <i className="fa-solid fa-circle-question" aria-hidden="true" />
          FAQs
        </a>
      </nav>

      {/* Organizer Card */}
      <div className="tp-organizer-card">
        <div className="tp-organizer-card__profile">
          <img
            className="organizer-avatar"
            src={partner.logo_url || "/placeholder-host.jpg"}
            alt={partner.name}
            loading="lazy"
          />
          <div className="organizer-info">
            <small>Organised by</small>
            <div className="tp-organizer-card__name">
              <strong>{partner.name}</strong>
              {partner.verified && (
                <span className="tp-verified" aria-label="Verified organizer">
                  <i className="fa-solid fa-check" aria-hidden="true" />
                </span>
              )}
            </div>
            <div className="partner-meta">
              <span>
                <i className="fa-solid fa-star" aria-hidden="true" />
                {partner.rating.toFixed(1)}
              </span>
              <span>
                <i className="fa-solid fa-route" aria-hidden="true" />
                {partner.trip_count}+ trips
              </span>
            </div>
          </div>
        </div>

        <div className="tp-organizer-card__aside">
          <span className="trusted-partner-badge">
            <i className="fa-solid fa-shield-check" aria-hidden="true" />
            Trusted Partner
          </span>
          {partner.instagram_url && (
            <a
              href={partner.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="organizer-social"
              aria-label={`${partner.name} Instagram`}
            >
              <i className="fa-brands fa-instagram" aria-hidden="true" />
            </a>
          )}
        </div>

        <div className="tp-trust-line">
          <span aria-hidden="true">
            <i className="fa-solid fa-shield-heart" />
          </span>
          <p>
            <strong>Tripanza Verified —</strong>
            All partners are background-checked with verified safety records and 24/7 emergency support.
          </p>
        </div>
      </div>
    </div>
  );
}
