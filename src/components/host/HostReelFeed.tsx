"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HostProfile, HostReel } from "@/lib/host";

export default function HostReelFeed({ profile, items }: { profile: HostProfile; items: HostReel[] }) {
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<number[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = Number((entry.target as HTMLElement).dataset.index);
        setActive(index);
      }
    }, { threshold: 0.65 });
    videos.current.forEach(video => { if (video) observer.observe(video); });
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => {
    videos.current.forEach((video, index) => {
      if (!video) return;
      video.muted = muted;
      if (index === active) void video.play().catch(() => {});
      else video.pause();
    });
  }, [active, muted]);

  async function share() {
    const url = `${window.location.origin}/host/${profile.slug}/reels`;
    try {
      if (navigator.share) await navigator.share({ title: `Reels by ${profile.name}`, url });
      else { await navigator.clipboard.writeText(url); setNotice("Link copied"); window.setTimeout(() => setNotice(""), 2500); }
    } catch { /* Sharing was cancelled. */ }
  }

  if (!items.length) return <div className="host-system"><div className="host-empty"><h1>Fresh drops soon.</h1><p>{profile.name} is collecting the next batch of trip moments.</p><Link className="host-button" href={`/host/${profile.slug}`}>Meet the host →</Link></div></div>;

  return <div className="host-reel-app"><main className="host-reel-stage" aria-label={`Reels by ${profile.name}`}><div className="host-reel-feed">
    {items.map((item, index) => <section className="host-reel-slide" key={item.id}>
      <video ref={element => { videos.current[index] = element; }} data-index={index} src={item.video} poster={item.tour.image} loop muted playsInline preload={index < 2 ? "metadata" : "none"} onClick={() => { const video = videos.current[index]; if (video?.paused) void video.play(); else video?.pause(); }} />
      <div className="host-reel-shade" />
      <header className="host-reel-top"><Link href={`/host/${profile.slug}`} aria-label="Back to host profile">←</Link><strong>{profile.name}<small>Community trip host</small></strong><span>{index + 1} / {items.length}</span></header>
      <div className="host-reel-actions"><button type="button" onClick={() => setMuted(value => !value)} aria-label={muted ? "Unmute" : "Mute"}>{muted ? "♪" : "◖))"}<small>{muted ? "Sound" : "Mute"}</small></button><button type="button" onClick={() => setLiked(value => value.includes(item.id) ? value.filter(id => id !== item.id) : [...value, item.id])} aria-label="Like reel" aria-pressed={liked.includes(item.id)}>{liked.includes(item.id) ? "♥" : "♡"}<small>Like</small></button><button type="button" onClick={() => void share()} aria-label="Share reel">↗<small>Share</small></button></div>
      <div className="host-reel-copy"><Link href={`/host/${profile.slug}`} className="host-reel-owner">{profile.logo && <img src={profile.logo} alt="" />}<span>{profile.name}{profile.verified && <b> ✓</b>}<small>Community trip host</small></span></Link><h1>{item.title || item.tour.title}</h1><p>{item.tour.address || "India"} · {item.tour.duration} days</p><div className="host-reel-cta"><span><small>THE TRIP</small><strong>{item.tour.title}</strong></span><Link href={`/tours/${item.tour.slug}`}>Explore trip →</Link></div></div>
    </section>)}
  </div></main>{notice && <span className="host-reel-toast" role="status">{notice}</span>}</div>;
}
