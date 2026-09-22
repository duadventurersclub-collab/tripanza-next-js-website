"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TourDetail } from "@/lib/st-tours";

interface TourReelsProps {
  tour: TourDetail;
}

export default function TourReels({ tour }: TourReelsProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const reels = tour.details.reels;
  const poster = tour.featured_image || tour.details.gallery[0]?.url || "";

  if (!reels.length) return null;

  return (
    <>
      <section
        className="mb-8 scroll-mt-24 overflow-hidden rounded-[26px] bg-[#121722] px-4 py-5 text-white shadow-[0_18px_45px_rgba(18,23,34,0.16)] sm:px-6 sm:py-6"
        id="reels"
        aria-labelledby="tour-reels-heading"
      >
        <header className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[9px] font-black uppercase tracking-[0.13em] text-[#d6eb50]">Trip vibes</span>
            <h2 id="tour-reels-heading" className="mt-1 text-[22px] font-black leading-tight tracking-[-0.035em] text-white sm:text-[28px]">
              Catch the vibe before you join
            </h2>
            <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-white/60 sm:text-sm">
              Real moments from this trip. Tap any reel to watch it full screen.
            </p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black text-[#d6eb50] sm:inline-flex">
            {reels.length} {reels.length === 1 ? "reel" : "reels"}
          </span>
        </header>

        <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:gap-4 sm:px-6">
          {reels.map((url, index) => (
            <ReelPreview
              key={`${url}-${index}`}
              url={url}
              index={index}
              title={tour.title}
              poster={poster}
              onOpen={() => setViewerIndex(index)}
            />
          ))}
        </div>
      </section>

      {viewerIndex !== null && typeof document !== "undefined"
        ? createPortal(
            <ReelsViewer tour={tour} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />,
            document.body,
          )
        : null}
    </>
  );
}

function ReelPreview({
  url,
  index,
  title,
  poster,
  onOpen,
}: {
  url: string;
  index: number;
  title: string;
  poster: string;
  onOpen: () => void;
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open reel ${index + 1} full screen`}
      className="group relative aspect-[9/16] w-[72vw] max-w-[270px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-white/15 bg-[#252b37] text-left shadow-xl sm:w-[235px] lg:w-[250px]"
    >
      {!hasError ? (
        <video
          src={url}
          poster={poster || undefined}
          playsInline
          muted
          preload="metadata"
          onError={() => setHasError(true)}
          className="pointer-events-none h-full w-full object-cover opacity-95 transition duration-300 group-hover:scale-[1.025] group-hover:opacity-100"
        />
      ) : poster ? (
        <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url("${poster.replaceAll('"', "%22")}")` }} />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[#31394b] to-[#11151e]" />
      )}

      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-black/15" />
      <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-white/20 text-white shadow-xl backdrop-blur-md transition group-hover:scale-105 group-hover:bg-white/30">
        <i className="fa-solid fa-play ml-1 text-lg" aria-hidden="true" />
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5">
        <span className="min-w-0">
          <strong className="block truncate text-[11px] font-black text-white">{title}</strong>
          <small className="mt-1 block text-[9px] font-bold text-white/65">Reel {index + 1} · Tap to watch</small>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md">
          <i className="fa-solid fa-expand text-[11px]" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

function ReelsViewer({
  tour,
  initialIndex,
  onClose,
}: {
  tour: TourDetail;
  initialIndex: number;
  onClose: () => void;
}) {
  const reels = tour.details.reels;
  const poster = tour.featured_image || tour.details.gallery[0]?.url || "";
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState<Set<number>>(() => new Set());
  const [saved, setSaved] = useState<Set<number>>(() => new Set());
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const [shareMessage, setShareMessage] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  const goTo = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const nextIndex = Math.max(0, Math.min(reels.length - 1, index));
      const feed = feedRef.current;
      const slide = slideRefs.current[nextIndex];
      if (feed && slide) feed.scrollTo({ top: slide.offsetTop, behavior });
    },
    [reels.length],
  );

  const toggleLiked = useCallback((index: number) => {
    setLiked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    const frame = requestAnimationFrame(() => goTo(initialIndex, "auto"));

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [goTo, initialIndex]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.reelIndex);
        if (Number.isFinite(index)) setActiveIndex(index);
      },
      { root: feed, threshold: [0.55, 0.7, 0.9] },
    );

    slideRefs.current.forEach((slide) => {
      if (slide) observer.observe(slide);
    });
    return () => observer.disconnect();
  }, [reels.length]);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      video.muted = isMuted;
      if (index !== activeIndex) {
        video.pause();
        return;
      }
      void video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    });
  }, [activeIndex, isMuted]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowDown") {
        event.preventDefault();
        goTo(activeIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        goTo(activeIndex - 1);
      } else if (event.key.toLowerCase() === "m") setIsMuted((current) => !current);
      else if (event.key.toLowerCase() === "l") toggleLiked(activeIndex);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, goTo, onClose, toggleLiked]);

  function togglePlayback() {
    const video = videoRefs.current[activeIndex];
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function toggleSaved(index: number) {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function shareReel() {
    const shareData = {
      title: tour.title,
      text: `Watch ${tour.title} on Tripanza`,
      url: `${window.location.href.split("#")[0]}#reels`,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        setShareMessage("Link copied");
        window.setTimeout(() => setShareMessage(""), 1800);
      }
    } catch {
      // Dismissing the native share dialog does not require an error state.
    }
  }

  const destination = tour.details.destination || tour.details.origin;
  const duration = tour.details.duration.days ? `${tour.details.duration.days}D / ${tour.details.duration.nights}N` : "";
  const price = tour.details.pricing.starting_price || tour.price;
  const partner = tour.details.partner.name || "Tripanza";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${tour.title} reels`}
      className="fixed inset-0 z-[2147483000] grid place-items-center bg-[#05070b] text-white sm:bg-black/95 sm:p-4"
    >
      <div className="relative h-[100dvh] w-full overflow-hidden bg-[#090b10] shadow-2xl sm:h-[min(920px,calc(100dvh-32px))] sm:max-w-[460px] sm:rounded-[28px] sm:ring-1 sm:ring-white/15">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-36 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[48%] bg-gradient-to-t from-black/95 via-black/45 to-transparent" />

        <div className="absolute inset-x-0 top-0 z-40 px-4 pt-[max(14px,env(safe-area-inset-top))]">
          <div className="mb-3 h-[3px] overflow-hidden rounded-full bg-white/25">
            <span className="block h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} aria-label="Close reels" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition hover:bg-black/65">
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-[#d6eb50]">Tripanza reels</span>
              <strong className="block truncate text-sm font-black">{tour.title}</strong>
            </div>
            <span className="rounded-full bg-black/35 px-2.5 py-1.5 text-[10px] font-black backdrop-blur-md">{activeIndex + 1} / {reels.length}</span>
            <button type="button" onClick={() => setIsMuted((current) => !current)} aria-label={isMuted ? "Turn sound on" : "Mute reel"} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition hover:bg-black/65">
              <i className={`fa-solid ${isMuted ? "fa-volume-xmark" : "fa-volume-high"}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div ref={feedRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {reels.map((url, index) => {
            const shouldLoad = Math.abs(index - activeIndex) <= 1;
            return (
              <div
                key={`${url}-${index}`}
                ref={(element) => { slideRefs.current[index] = element; }}
                data-reel-index={index}
                className="relative h-full min-h-full snap-start snap-always bg-black"
              >
                {failed.has(index) ? (
                  <div className="grid h-full place-items-center bg-gradient-to-br from-[#252b37] to-[#090b10] px-8 text-center">
                    <div>
                      <i className="fa-solid fa-circle-exclamation text-3xl text-[#d6eb50]" aria-hidden="true" />
                      <p className="mt-4 text-base font-black">This reel could not be loaded</p>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-full bg-[#d6eb50] px-5 py-3 text-xs font-black text-[#151900]">Open original reel</a>
                    </div>
                  </div>
                ) : (
                  <video
                    ref={(element) => { videoRefs.current[index] = element; }}
                    src={shouldLoad ? url : undefined}
                    poster={poster || undefined}
                    playsInline
                    loop
                    muted={isMuted}
                    preload={index === activeIndex ? "auto" : "metadata"}
                    onClick={togglePlayback}
                    onDoubleClick={() => toggleLiked(index)}
                    onPlay={() => index === activeIndex && setIsPlaying(true)}
                    onPause={() => index === activeIndex && setIsPlaying(false)}
                    onTimeUpdate={(event) => {
                      if (index !== activeIndex) return;
                      const video = event.currentTarget;
                      setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
                    }}
                    onError={() => setFailed((current) => new Set(current).add(index))}
                    aria-label={`${tour.title}, reel ${index + 1}`}
                    className="h-full w-full cursor-pointer object-cover"
                  />
                )}
              </div>
            );
          })}
        </div>

        {!isPlaying && !failed.has(activeIndex) ? (
          <button type="button" onClick={togglePlayback} aria-label="Play reel" className="absolute left-1/2 top-1/2 z-40 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/40 text-white shadow-2xl backdrop-blur-md">
            <i className="fa-solid fa-play ml-1 text-xl" aria-hidden="true" />
          </button>
        ) : null}

        <div className="absolute bottom-[calc(174px+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col gap-3">
          <ReelAction label={liked.has(activeIndex) ? "Unlike" : "Like"} icon={liked.has(activeIndex) ? "fa-solid fa-heart" : "fa-regular fa-heart"} active={liked.has(activeIndex)} onClick={() => toggleLiked(activeIndex)} />
          <ReelAction label="Share" icon="fa-solid fa-share" onClick={shareReel} />
          <ReelAction label={saved.has(activeIndex) ? "Saved" : "Save"} icon={saved.has(activeIndex) ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark"} active={saved.has(activeIndex)} onClick={() => toggleSaved(activeIndex)} />
          {reels.length > 1 ? (
            <div className="mt-1 flex flex-col overflow-hidden rounded-full border border-white/15 bg-black/35 backdrop-blur-md">
              <button type="button" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous reel" className="grid h-9 w-10 place-items-center border-b border-white/10 text-white disabled:opacity-30">
                <i className="fa-solid fa-chevron-up text-[10px]" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => goTo(activeIndex + 1)} disabled={activeIndex === reels.length - 1} aria-label="Next reel" className="grid h-9 w-10 place-items-center text-white disabled:opacity-30">
                <i className="fa-solid fa-chevron-down text-[10px]" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pr-20">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#d6eb50] text-xs font-black text-[#141900]">{partner.charAt(0).toUpperCase()}</span>
            <strong className="truncate text-xs font-black">{partner}</strong>
            {tour.details.partner.verified ? <i className="fa-solid fa-circle-check text-[11px] text-[#72a8ff]" aria-label="Verified" /> : null}
          </div>
          <h3 className="mt-2 line-clamp-2 text-lg font-black leading-tight tracking-[-0.025em]">{tour.title}</h3>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-white/70">
            {destination ? <span><i className="fa-solid fa-location-dot mr-1" />{destination}</span> : null}
            {duration ? <span><i className="fa-regular fa-clock mr-1" />{duration}</span> : null}
            {tour.details.rating.value ? <span><i className="fa-solid fa-star mr-1 text-[#ffd451]" />{tour.details.rating.value}</span> : null}
          </div>
          <div className="pointer-events-auto mt-3 flex items-center gap-3">
            {price ? (
              <div className="min-w-0">
                <span className="block text-[8px] font-black uppercase tracking-wider text-white/55">Starts from</span>
                <strong className="block truncate text-base font-black text-[#d6eb50]">{price}</strong>
              </div>
            ) : null}
            <a href={`/booking?tour=${tour.id}`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#d6eb50] px-4 text-xs font-black text-[#151900] shadow-lg transition hover:bg-[#e2f77b]">
              <i className="fa-solid fa-bolt" aria-hidden="true" />Book this trip
            </a>
          </div>
        </div>

        {shareMessage ? <div className="absolute left-1/2 top-24 z-50 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-[11px] font-black text-black shadow-xl">{shareMessage}</div> : null}
      </div>
    </div>
  );
}

function ReelAction({
  label,
  icon,
  active = false,
  onClick,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex w-12 flex-col items-center gap-1 text-white">
      <span className={`grid h-11 w-11 place-items-center rounded-full border backdrop-blur-md transition ${active ? "border-[#ff5470]/50 bg-[#ff3158]/25 text-[#ff5470]" : "border-white/15 bg-black/35 hover:bg-black/60"}`}>
        <i className={`${icon} text-base`} aria-hidden="true" />
      </span>
      <span className="text-[8px] font-black drop-shadow">{label}</span>
    </button>
  );
}
