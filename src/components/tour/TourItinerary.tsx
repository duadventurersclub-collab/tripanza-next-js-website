"use client";

import { useState, useRef, useCallback } from "react";
import type { TourDetail } from "@/lib/wp";

interface TourItineraryProps {
  tour: TourDetail;
}

function StayGallery({ images, title }: { images: string[]; title: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  const goTo = useCallback((idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(images.length - 1, idx));
    setCurrentIdx(clamped);
    const slide = track.children[clamped] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }, [images.length]);

  return (
    <div className="tp-stay-gallery" data-tp-gallery>
      <div className="tp-stay-gallery__track" ref={trackRef}>
        {images.map((img, i) => (
          <figure key={i} className="tp-stay-gallery__slide" style={{ margin: 0 }}>
            <img src={img} alt={`${title} photo ${i + 1}`} loading="lazy" decoding="async" />
          </figure>
        ))}
      </div>
      {images.length > 1 && (
        <div className="tp-stay-gallery__controls">
          <div className="tp-stay-gallery__count">
            {currentIdx + 1} / {images.length}
          </div>
          <div className="tp-stay-gallery__dots" aria-hidden="true">
            {images.map((_, i) => (
              <span key={i} className={i === currentIdx ? "is-active" : ""} />
            ))}
          </div>
          <span>
            <button
              type="button"
              aria-label="Previous accommodation photo"
              onClick={() => goTo(currentIdx - 1)}
            >
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next accommodation photo"
              onClick={() => goTo(currentIdx + 1)}
            >
              <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

function DayCard({ day, index, title, description, imageUrl }: {
  day: number;
  index: number;
  title: string;
  description: string;
  imageUrl?: string;
}) {
  const [isOpen, setIsOpen] = useState(index === 0);
  const panelId = `tp-trip-day-content-${day}`;
  const dayLabel = String(day).padStart(2, "0");

  // Strip "Day X:" prefix from display title
  const displayTitle = title.replace(/^\s*day\s*\d+\s*(?::|–|-|\|)\s*/i, "") || title;

  return (
    <article
      className={`tp-itinerary-day${imageUrl ? " tp-itinerary-day--visual" : ""}${isOpen ? " is-visible" : ""}`}
      id={`tp-trip-day-${day}`}
      data-journey-day={day}
    >
      <div className="tp-itinerary-day__marker" aria-hidden="true">
        <small>Day</small>
        <strong>{dayLabel}</strong>
      </div>

      <div className="tp-itinerary-day__card">
        <button
          type="button"
          className="tp-itinerary-day__toggle"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((v) => !v)}
        >
          <span className="tp-itinerary-day__tile-number">
            <small>Day</small>
            <strong>{dayLabel}</strong>
          </span>
          <strong className="tp-itinerary-day__tile-title">{displayTitle}</strong>
          <span className="tp-itinerary-day__tile-action" aria-hidden="true">
            <i className="fa-solid fa-plus" />
          </span>
        </button>

        <div className="tp-itinerary-day__collapse" id={panelId} hidden={!isOpen}>
          <div style={{ display: imageUrl ? "grid" : "block", gridTemplateColumns: imageUrl ? "minmax(180px,34%) minmax(0,1fr)" : undefined }}>
            {imageUrl && (
              <div className="tp-itinerary-day__media">
                <img src={imageUrl} alt={displayTitle} loading="lazy" decoding="async" />
                <div className="tp-itinerary-day__media-number" aria-hidden="true">
                  {dayLabel}
                </div>
              </div>
            )}
            <div className="tp-itinerary-day__body">
              <span className="tp-itinerary-day__eyebrow">
                <i className="fa-solid fa-sparkles" aria-hidden="true" /> Your next chapter
              </span>
              {description && (
                <div
                  className="tp-itinerary-day__desc"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              )}
              <span className="tp-itinerary-day__end">
                <i className="fa-solid fa-route" aria-hidden="true" style={{ marginRight: 5 }} />
                Part of your Tripanza journey
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function FAQPanel({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `tp-faq-panel-${index}`;
  const num = String(index + 1).padStart(2, "0");

  return (
    <article className={`tp-itinerary-panel${isOpen ? " active" : ""}`}>
      <button
        type="button"
        className="tp-itinerary-panel__trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span className="tp-itinerary-panel__question">{num}</span>
        <strong>{question}</strong>
        <i className="fa-solid fa-plus" aria-hidden="true" />
      </button>
      <div
        className="tp-itinerary-panel__content"
        id={panelId}
        hidden={!isOpen}
        dangerouslySetInnerHTML={{ __html: answer }}
      />
    </article>
  );
}

export default function TourItinerary({ tour }: TourItineraryProps) {
  const details = tour.details;
  const [viewMode, setViewMode] = useState<"short" | "detailed">("short");

  const hasItinerary = details.itinerary.length > 0;
  const hasHighlights = details.highlights.length > 0;
  const hasStays = details.stays.length > 0;
  const hasIncExc = details.included.length > 0 || details.excluded.length > 0;
  const hasFAQs = details.faqs.length > 0;

  if (!hasItinerary && !hasHighlights && !hasStays && !hasIncExc && !hasFAQs) return null;

  return (
    <section className="tp-itinerary-app" aria-labelledby="tp-itinerary-heading">
      {/* Hero Banner */}
      <header className="tp-itinerary-hero">
        <div className="tp-itinerary-hero__top">
          <span className="tp-itinerary-hero__icon" aria-hidden="true">
            <i className="fa-solid fa-route" />
          </span>
          <div className="tp-itinerary-hero__copy">
            <span className="tp-itinerary-kicker">Your trip story</span>
            <h2 id="tp-itinerary-heading">Every day, thoughtfully planned</h2>
            <p>See how the experience unfolds—from the first hello to the final memory.</p>
          </div>
          {hasItinerary && (
            <span className="tp-itinerary-hero__count">
              <strong>{details.itinerary.length}</strong>
              <small>{details.itinerary.length === 1 ? "day" : "days"}</small>
            </span>
          )}
        </div>
        <div className="tp-itinerary-hero__route" aria-hidden="true">
          <span className="tp-itinerary-hero__dot" />
          <span className="tp-itinerary-hero__line">
            <i className="fa-solid fa-location-arrow" />
          </span>
          <span className="tp-itinerary-hero__dot" />
        </div>
      </header>

      {/* Day-by-Day Itinerary */}
      {hasItinerary && (
        <section className="tp-itinerary-section tp-itinerary-journey" id="tp-trip-days">
          <header className="tp-itinerary-section__head">
            <span className="tp-itinerary-section__number">01</span>
            <span>
              <small>The journey</small>
              <h3>Your day-by-day experience</h3>
            </span>
            <span className="tp-itinerary-section__hint">
              <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
              Curated for you
            </span>
          </header>

          {/* View Toggle */}
          <div className="tp-journey-view-buttons" role="group" aria-label="Itinerary detail level">
            <button
              type="button"
              className={viewMode === "short" ? "is-active" : ""}
              aria-pressed={viewMode === "short"}
              onClick={() => setViewMode("short")}
            >
              <i className="fa-solid fa-compress" aria-hidden="true" />
              <span>
                <strong>Short itinerary</strong>
                <small>Tap a day to explore</small>
              </span>
            </button>
            <button
              type="button"
              className={viewMode === "detailed" ? "is-active" : ""}
              aria-pressed={viewMode === "detailed"}
              onClick={() => setViewMode("detailed")}
            >
              <i className="fa-solid fa-expand" aria-hidden="true" />
              <span>
                <strong>Detailed itinerary</strong>
                <small>See every day</small>
              </span>
            </button>
          </div>

          <div className="tp-itinerary-timeline">
            {details.itinerary.map((day, idx) => (
              <DayCard
                key={day.day}
                day={day.day}
                index={viewMode === "detailed" ? -1 : idx}
                title={day.title}
                description={day.description}
                imageUrl={day.image_url}
              />
            ))}
          </div>
        </section>
      )}

      {/* Highlights */}
      {hasHighlights && (
        <section className="tp-itinerary-section tp-itinerary-highlights" id="tp-trip-highlights">
          <header className="tp-itinerary-section__head">
            <span className="tp-itinerary-section__number">02</span>
            <span>
              <small>Why you will love it</small>
              <h3>Moments worth travelling for</h3>
            </span>
          </header>
          <ul>
            {details.highlights.map((h, i) => (
              <li key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{h}</p>
                <i className="fa-solid fa-arrow-trend-up" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Stays */}
      {hasStays && (
        <section className="tp-itinerary-section tp-itinerary-stays" id="tp-trip-stays">
          <header className="tp-itinerary-section__head">
            <span className="tp-itinerary-section__number">03</span>
            <span>
              <small>Rest well</small>
              <h3>Your stay, sorted</h3>
            </span>
            <span className="tp-itinerary-section__hint">
              <i className="fa-solid fa-shield-heart" aria-hidden="true" />
              Comfort checked
            </span>
          </header>
          <div className="tp-itinerary-stays__list">
            {details.stays.map((stay, idx) => (
              <article key={idx} className="tp-stay-card">
                {stay.images.length > 0 && (
                  <StayGallery images={stay.images} title={stay.title} />
                )}
                <div className="tp-stay-card__body">
                  <div className="tp-stay-card__status">
                    <span className="tp-itinerary-kicker">
                      {details.stays.length > 1 ? `Stay ${idx + 1}` : "Your stay"}
                    </span>
                    <span>
                      <i className="fa-solid fa-shield-heart" aria-hidden="true" />
                      Tripanza checked
                    </span>
                  </div>
                  <h4>{stay.title}</h4>
                  <div className="tp-stay-card__meta">
                    {stay.location && (
                      <span>
                        <i className="fa-solid fa-location-dot" aria-hidden="true" />
                        {stay.location}
                      </span>
                    )}
                    {stay.type && (
                      <span>
                        <i className="fa-solid fa-building" aria-hidden="true" />
                        {stay.type}
                      </span>
                    )}
                  </div>
                  {stay.description && (
                    <div className="tp-stay-card__desc">
                      <p>{stay.description}</p>
                    </div>
                  )}
                  {stay.amenities.length > 0 && (
                    <div className="tp-stay-card__amenities" aria-label="Stay amenities">
                      {stay.amenities.slice(0, 6).map((a, ai) => (
                        <span key={ai}>
                          <i className="fa-solid fa-check" aria-hidden="true" />
                          {a}
                        </span>
                      ))}
                      {stay.amenities.length > 6 && (
                        <span style={{ color: "#3157d5", background: "#edf2ff", border: "none", cursor: "default" }}>
                          +{stay.amenities.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Included / Excluded */}
      {hasIncExc && (
        <section className="tp-itinerary-section tp-itinerary-cover" id="tp-trip-cover">
          <header className="tp-itinerary-section__head">
            <span className="tp-itinerary-section__number">04</span>
            <span>
              <small>No surprises</small>
              <h3>Know exactly what is covered</h3>
            </span>
          </header>
          <div className="tp-itinerary-cover__grid">
            {details.included.length > 0 && (
              <article className="tp-cover-card tp-cover-card--yes">
                <header>
                  <span>
                    <i className="fa-solid fa-check" aria-hidden="true" />
                  </span>
                  <div>
                    <small>Already covered</small>
                    <h4>Included in your trip</h4>
                  </div>
                </header>
                <ul>
                  {details.included.map((item, i) => (
                    <li key={i}>
                      <i className="fa-solid fa-circle-check" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            )}
            {details.excluded.length > 0 && (
              <article className="tp-cover-card tp-cover-card--no">
                <header>
                  <span>
                    <i className="fa-solid fa-wallet" aria-hidden="true" />
                  </span>
                  <div>
                    <small>Plan separately</small>
                    <h4>Not included</h4>
                  </div>
                </header>
                <ul>
                  {details.excluded.map((item, i) => (
                    <li key={i}>
                      <i className="fa-solid fa-minus" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            )}
          </div>
        </section>
      )}

      {/* FAQs */}
      {hasFAQs && (
        <section className="tp-itinerary-section tp-itinerary-faq" id="tp-trip-faq">
          <header className="tp-itinerary-section__head">
            <span className="tp-itinerary-section__number">05</span>
            <span>
              <small>Before you go</small>
              <h3>Good to know</h3>
            </span>
          </header>
          <div className="tp-itinerary-faq__list">
            {details.faqs.map((faq, i) => (
              <FAQPanel key={i} question={faq.question} answer={faq.answer} index={i} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
