"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HostProfile, HostReel } from "@/lib/host";
import "./reel-feed-original.css";

export default function HostReelFeed({ profile, items }: { profile: HostProfile; items: HostReel[] }) {
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<number[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
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

  return <div className="thr-app"><main className="thr-stage" aria-label={`Reels by ${profile.name}`}><div className="thr-feed">
    {items.map((item, index) => <section className="thr-reel" key={item.id}>
      <video className="thr-video" ref={element => { videos.current[index] = element; }} data-index={index} src={item.video} poster={item.tour.image} loop muted playsInline preload={index < 2 ? "metadata" : "none"} onClick={() => { const video = videos.current[index]; if (video?.paused) void video.play(); else video?.pause(); }} />
      <div className="thr-shade" />
      <header className="thr-top"><Link className="thr-icon" href={`/host/${profile.slug}`} aria-label="Back to host profile">←</Link><div className="thr-brand"><small>HOST TRIP DROPS</small><strong>{profile.name}</strong></div><span className="thr-count">{index + 1} / {items.length}</span><button type="button" className="thr-icon" onClick={() => setMuted(value => !value)} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "♪" : "◖))"}</button></header>
      <div className="thr-actions"><button type="button" className={`thr-action ${liked.includes(item.id) ? "is-active" : ""}`} onClick={() => setLiked(value => value.includes(item.id) ? value.filter(id => id !== item.id) : [...value, item.id])} aria-label="Like reel" aria-pressed={liked.includes(item.id)}><i>{liked.includes(item.id) ? "♥" : "♡"}</i><span>Like</span></button><button type="button" className={`thr-action ${saved.includes(item.id) ? "is-active" : ""}`} onClick={() => setSaved(value => value.includes(item.id) ? value.filter(id => id !== item.id) : [...value, item.id])} aria-label="Save reel" aria-pressed={saved.includes(item.id)}><i>{saved.includes(item.id) ? "▣" : "▢"}</i><span>Save</span></button><button type="button" className="thr-action" onClick={() => void share()} aria-label="Share reel"><i>↗</i><span>Share</span></button></div>
      <div className="thr-copy"><Link href={`/host/${profile.slug}`} className="thr-host">{profile.logo && <img src={profile.logo} alt="" />}<span><strong>{profile.name}{profile.verified && <b> ✓</b>}</strong><small>Community trip host</small></span></Link><h1 className="thr-title">{item.title || item.tour.title}</h1><div className="thr-meta"><span>{item.tour.address || "India"}</span><span>{item.tour.duration} days</span><span>18-28 community</span></div><div className="thr-cta"><div className="thr-price"><small>YOUR NEXT GROUP TRIP</small><strong>See trip details</strong></div><Link href={`/tours/${item.tour.slug}`}>Explore trip →</Link></div></div>
    </section>)}
  </div></main>{notice && <span className="thr-toast" role="status">{notice}</span>}</div>;
}
