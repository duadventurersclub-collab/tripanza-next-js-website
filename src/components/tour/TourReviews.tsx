"use client";

import { useRef, useState } from "react";
import type { TourReview } from "@/lib/st-tours";

export default function TourReviews({ reviews }: { reviews: TourReview[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  if (!reviews.length) return null;

  const average = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;

  function goTo(index: number) {
    const next = Math.max(0, Math.min(reviews.length - 1, index));
    const card = trackRef.current?.children[next] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setActiveIndex(next);
  }

  return (
    <section className="tp-google-reviews" aria-labelledby="tp-google-reviews-title">
      <header className="tp-google-reviews__head">
        <div>
          <span className="tp-google-reviews__eyebrow">Tripanza community</span>
          <h2 id="tp-google-reviews-title">Real trips. Real people. Zero brochure energy.</h2>
          <p>Straight from travellers who came for the trip and stayed for the memories.</p>
        </div>
        <div className="tp-google-reviews__score" aria-label={`Average rating ${average.toFixed(1)} out of 5`}>
          <strong>{average.toFixed(1)}</strong>
          <span>★ Rated on Google</span>
        </div>
      </header>

      <div
        className="tp-google-reviews__track"
        ref={trackRef}
        tabIndex={0}
        aria-label="Google customer reviews"
        onScroll={(event) => {
          const track = event.currentTarget;
          const center = track.scrollLeft + track.clientWidth / 2;
          let nearest = 0;
          let distance = Number.POSITIVE_INFINITY;
          Array.from(track.children).forEach((child, index) => {
            const card = child as HTMLElement;
            const delta = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
            if (delta < distance) { distance = delta; nearest = index; }
          });
          setActiveIndex(nearest);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            goTo(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
          }
        }}
      >
        {reviews.map((review, index) => (
          <article className={`tp-google-review${index === activeIndex ? " is-active" : ""}`} key={`${review.author_name}-${index}`}>
            <div className="tp-google-review__top">
              <div className="tp-google-review__person">
                <span aria-hidden="true">{review.author_name.charAt(0).toUpperCase()}</span>
                <div><strong>{review.author_name}</strong>{review.date ? <small>{review.date}</small> : null}</div>
              </div>
              <span className="tp-google-review__google" aria-label="Google review">G</span>
            </div>
            <div className="tp-google-review__stars" aria-label={`${review.rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, star) => star < Math.round(review.rating) ? "★" : "☆").join("")}
            </div>
            <blockquote>{review.text}</blockquote>
            <span className="tp-google-review__quote" aria-hidden="true">“</span>
          </article>
        ))}
      </div>

      <div className="tp-google-reviews__deck-nav">
        <span>Swipe traveller stories</span>
        <span className="tp-google-reviews__deck-dots" aria-hidden="true">
          {reviews.map((_, index) => <i className={index === activeIndex ? "is-active" : ""} key={index} />)}
        </span>
        <span className="tp-google-reviews__deck-arrows">
          <button type="button" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous review">←</button>
          <button type="button" onClick={() => goTo(activeIndex + 1)} disabled={activeIndex === reviews.length - 1} aria-label="Next review">→</button>
        </span>
      </div>
    </section>
  );
}
