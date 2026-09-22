"use client";

import { useEffect, useRef, useState } from "react";

interface TourReelsProps {
  reels: string[];
  title: string;
  poster?: string;
}

export default function TourReels({ reels, title, poster }: TourReelsProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!reels?.length) return null;

  return (
    <section
      className="mb-8 scroll-mt-24 overflow-hidden rounded-[26px] bg-[#121722] px-4 py-5 text-white shadow-[0_18px_45px_rgba(18,23,34,0.16)] sm:px-6 sm:py-6"
      id="reels"
      aria-labelledby="tour-reels-heading"
    >
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[9px] font-black uppercase tracking-[0.13em] text-[#d6eb50]">
            Trip vibes
          </span>
          <h2
            id="tour-reels-heading"
            className="mt-1 text-[22px] font-black leading-tight tracking-[-0.035em] text-white sm:text-[28px]"
          >
            Catch the vibe before you join
          </h2>
          <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-white/60 sm:text-sm">
            Real moments from this trip. Tap a reel to play it with sound controls.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black text-[#d6eb50] sm:inline-flex">
          {reels.length} {reels.length === 1 ? "reel" : "reels"}
        </span>
      </header>

      <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:gap-4 sm:px-6">
        {reels.map((url, index) => (
          <ReelVideo
            key={`${url}-${index}`}
            url={url}
            index={index}
            title={title}
            poster={poster}
            isActive={activeIndex === index}
            onActivate={() => setActiveIndex(index)}
            onDeactivate={() => setActiveIndex((current) => (current === index ? null : current))}
          />
        ))}
      </div>
    </section>
  );
}

function ReelVideo({
  url,
  index,
  title,
  poster,
  isActive,
  onActivate,
  onDeactivate,
}: {
  url: string;
  index: number;
  title: string;
  poster?: string;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!isActive && video && !video.paused) video.pause();
  }, [isActive]);

  async function togglePlay() {
    const video = videoRef.current;
    if (!video || hasError) return;

    if (video.paused) {
      onActivate();
      try {
        await video.play();
      } catch {
        setHasError(true);
        onDeactivate();
      }
    } else {
      video.pause();
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  return (
    <article className="group relative aspect-[9/16] w-[72vw] max-w-[270px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-white/15 bg-[#252b37] shadow-xl sm:w-[235px] lg:w-[250px]">
      <video
        ref={videoRef}
        src={url}
        poster={poster || undefined}
        playsInline
        loop
        muted={isMuted}
        preload="metadata"
        onClick={togglePlay}
        onPlay={() => {
          setIsPlaying(true);
          onActivate();
        }}
        onPause={() => {
          setIsPlaying(false);
          onDeactivate();
        }}
        onError={() => {
          setHasError(true);
          setIsPlaying(false);
          onDeactivate();
        }}
        className="h-full w-full cursor-pointer object-cover opacity-95 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/10" />

      {!isPlaying && !hasError && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={`Play reel ${index + 1}`}
          className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-white/20 text-white shadow-xl backdrop-blur-md transition hover:scale-105 hover:bg-white/30"
        >
          <i className="fa-solid fa-play ml-1 text-lg" aria-hidden="true" />
        </button>
      )}

      {hasError ? (
        <div className="absolute inset-0 grid place-items-center bg-[#1b202b]/95 p-5 text-center">
          <div>
            <i className="fa-solid fa-link mb-3 text-xl text-[#d6eb50]" aria-hidden="true" />
            <p className="text-sm font-black">Open this reel externally</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex rounded-full bg-[#d6eb50] px-4 py-2 text-[10px] font-black text-[#172000]"
            >
              Watch reel
            </a>
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5">
          <span className="min-w-0">
            <strong className="block truncate text-[11px] font-black text-white">{title}</strong>
            <small className="mt-1 block text-[9px] font-bold text-white/65">Reel {index + 1}</small>
          </span>
          <span className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? `Pause reel ${index + 1}` : `Play reel ${index + 1}`}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/70"
            >
              <i className={`fa-solid ${isPlaying ? "fa-pause" : "fa-play"} text-[10px]`} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? `Unmute reel ${index + 1}` : `Mute reel ${index + 1}`}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/70"
            >
              <i className={`fa-solid ${isMuted ? "fa-volume-xmark" : "fa-volume-high"} text-[10px]`} aria-hidden="true" />
            </button>
          </span>
        </div>
      )}
    </article>
  );
}
