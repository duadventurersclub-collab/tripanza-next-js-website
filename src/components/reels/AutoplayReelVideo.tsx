"use client";

import { useEffect, useRef } from "react";

type AutoplayReelVideoProps = {
  src: string;
  poster?: string;
  className?: string;
  ariaLabel?: string;
  onError?: () => void;
};

export default function AutoplayReelVideo({ src, poster, className, ariaLabel, onError }: AutoplayReelVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const visibleRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncPlayback = () => {
      if (visibleRef.current && !document.hidden) void video.play().catch(() => undefined);
      else video.pause();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.3);
        syncPlayback();
      },
      { threshold: [0, 0.3, 0.65], rootMargin: "100px 0px" },
    );

    observer.observe(video);
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      video.pause();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className={className}
      aria-label={ariaLabel}
      muted
      loop
      playsInline
      preload="metadata"
      disablePictureInPicture
      onCanPlay={(event) => {
        if (visibleRef.current && !document.hidden) void event.currentTarget.play().catch(() => undefined);
      }}
      onError={onError}
    />
  );
}
