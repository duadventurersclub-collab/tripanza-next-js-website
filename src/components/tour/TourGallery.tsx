"use client";

import { useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { TourDetail } from "@/lib/wp";

interface TourGalleryProps {
  tour: TourDetail;
}

export default function TourGallery({ tour }: TourGalleryProps) {
  const gallery = tour.details.gallery.length ? tour.details.gallery : tour.featured_image ? [{ url: tour.featured_image, alt: tour.title }] : [];
  const reels = tour.details.reels;
  const reelPreviewUrl = reels[0] || "";
  const reel0 = gallery[0]?.url || tour.featured_image || "";
  const galleryCount = gallery.length;
  const galleryUid = `tp-tour-gallery-${tour.id}`;

  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const dotsRef = useRef<HTMLButtonElement[]>([]);
  const reelVideoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number | null>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  const activeIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return 0;
    const slides = track.querySelectorAll<HTMLElement>(".tp-tour-gallery__slide");
    return Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
  }, []);

  const renderState = useCallback(() => {
    frameRef.current = null;
    const idx = activeIndex();
    if (countRef.current) countRef.current.textContent = String(idx + 1).padStart(2, "0");
    const slides = trackRef.current?.querySelectorAll<HTMLElement>(".tp-tour-gallery__slide") || [];
    dotsRef.current.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === idx);
      if (i === idx) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    if (progressRef.current) {
      progressRef.current.style.width = `${((idx + 1) / slides.length) * 100}%`;
    }
  }, [activeIndex]);

  const requestState = useCallback(() => {
    if (!frameRef.current) {
      frameRef.current = window.requestAnimationFrame(renderState);
    }
  }, [renderState]);

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const slides = track.querySelectorAll<HTMLElement>(".tp-tour-gallery__slide");
    const clamped = Math.max(0, Math.min(slides.length - 1, index));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", requestState, { passive: true });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(activeIndex() + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(activeIndex() - 1); }
    };
    track.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", renderState, { passive: true });
    renderState();
    return () => {
      track.removeEventListener("scroll", requestState);
      track.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", renderState);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [activeIndex, goTo, renderState, requestState]);

  // Lazy reel preview via IntersectionObserver
  useEffect(() => {
    const video = reelVideoRef.current;
    if (!video || !reelPreviewUrl || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let loaded = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          if (!loaded) {
            video.src = reelPreviewUrl;
            video.load();
            loaded = true;
          }
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: [0, 0.25, 0.75] });
    observer.observe(video);
    return () => observer.disconnect();
  }, [reelPreviewUrl]);

  return (
    <>
      <section id={galleryUid} className="tp-tour-gallery" aria-label={`${tour.title} photo gallery`}>
        <div className="tp-tour-gallery__viewport">
          {/* Main Scroll Track */}
          <div
            className="tp-tour-gallery__track"
            ref={trackRef}
            tabIndex={0}
            aria-roledescription="carousel"
          >
            {gallery.map((img, i) => (
              <figure
                key={i}
                className="tp-tour-gallery__slide"
                aria-label={`Photo ${i + 1} of ${galleryCount}`}
              >
                <Image
                  src={img.url}
                  alt={img.alt || `${tour.title} – photo ${i + 1} of ${galleryCount}`}
                  fill
                  sizes="100vw"
                  className="tp-tour-gallery__image"
                  priority={i === 0}
                  draggable={false}
                />
              </figure>
            ))}
          </div>

          <div className="tp-app-hero-copy">
            <span className="tp-app-hero-kicker"><span /> THE NEXT CHAPTER</span>
            <strong>{tour.details.destination || tour.title}</strong>
            <p>{tour.details.duration.days ? `${tour.details.duration.days} days of new stories` : "A new place. A new story."}{tour.details.origin ? ` · From ${tour.details.origin}` : ""}</p>
          </div>
          <span className="tp-app-hero-sticker" aria-hidden="true">GOOD TRIPS.<br />BETTER PEOPLE. <i>✳</i></span>
          {galleryCount > 0 && <div className="tp-app-photo-count" aria-label={`${galleryCount} trip photos`}><i className="fa-regular fa-images" aria-hidden="true" /><span ref={countRef}>01</span><span>/ {String(galleryCount).padStart(2, "0")}</span></div>}

          {/* Reel Preview */}
          {reelPreviewUrl && (
            <a
              className="tp-tour-gallery__reel"
              href="#reels"
              aria-label="Watch trip videos"
            >
              <video
                ref={reelVideoRef}
                muted
                loop
                playsInline
                preload="none"
                poster={reel0}
                aria-hidden="true"
              />
              <span>
                <i className="fa-solid fa-play" aria-hidden="true" />
                Trip vibes
              </span>
            </a>
          )}

          {/* Navigation Arrows */}
          {galleryCount > 1 && (
            <>
              <button
                className="tp-tour-gallery__arrow tp-tour-gallery__arrow--previous"
                type="button"
                aria-label="Previous photo"
                onClick={() => goTo(activeIndex() - 1)}
              >
                <i className="fa-solid fa-chevron-left" aria-hidden="true" />
              </button>
              <button
                className="tp-tour-gallery__arrow tp-tour-gallery__arrow--next"
                type="button"
                aria-label="Next photo"
                onClick={() => goTo(activeIndex() + 1)}
              >
                <i className="fa-solid fa-chevron-right" aria-hidden="true" />
              </button>
            </>
          )}

          {/* Dot Pagination */}
          {galleryCount > 1 && (
            <div className="tp-tour-gallery__pagination" aria-label="Choose a gallery photo">
              {gallery.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={i === 0 ? "is-active" : ""}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === 0 ? "true" : undefined}
                  ref={(el) => { if (el) dotsRef.current[i] = el; }}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          )}

          {/* Progress Bar */}
          {galleryCount > 1 && (
            <div className="tp-tour-gallery__progress" aria-hidden="true">
              <span ref={progressRef} />
            </div>
          )}
        </div>

        {/* Trust Tags */}
        <div className="tp-tour-gallery__trust" aria-label="Who this trip is for">
          <div className="tp-tour-gallery__trust-intro">
            <strong>Community trip</strong>
            <i className="fa-solid fa-bolt" aria-hidden="true" />
          </div>
          <div className="tp-tour-gallery__trust-tags">
            <span>18–28 only</span>
            <span>Strangers only</span>
            <span>Women-friendly</span>
          </div>
        </div>
      </section>
    </>
  );
}
