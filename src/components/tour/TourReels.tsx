"use client";

import { useState, useRef } from "react";

interface TourReelsProps {
  reels: string[];
}

export default function TourReels({ reels }: TourReelsProps) {
  if (!reels || reels.length === 0) return null;

  return (
    <section className="mb-16 scroll-mt-24" id="reels">
      <div className="mb-6 flex items-end justify-between px-6 sm:px-0">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Trip Reels <span className="text-emerald-500">.</span>
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Real moments from this experience.
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-6 pb-6 pt-2 sm:px-0 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {reels.map((url, index) => (
            <ReelVideo key={index} url={url} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReelVideo({ url, index }: { url: string; index: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <div 
      className="relative aspect-[9/16] w-[260px] sm:w-[300px] shrink-0 snap-center overflow-hidden rounded-3xl bg-slate-900 shadow-xl cursor-pointer group"
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={url}
        playsInline
        loop
        muted={isMuted}
        className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
      />
      
      {/* Play/Pause Overlay */}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isPlaying ? 'opacity-0' : 'opacity-100 bg-slate-900/40'}`}>
        {!isPlaying && (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
            <i className="fa-solid fa-play ml-1 text-2xl text-white" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/80 to-transparent p-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-1 text-xs font-bold text-white">
          Reel {index + 1}
        </span>
        <button 
          onClick={toggleMute} 
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/60 backdrop-blur-md text-white transition hover:bg-slate-900"
        >
          <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'} text-xs`} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
