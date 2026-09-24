"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MetaReel } from "@/lib/meta-reels";

const DEFAULT_PARTNER_LOGO = "https://tripanza.com/wp-content/uploads/2021/03/cropped-Tripanza-Logo-11.png";

type IconName = "back" | "muted" | "volume" | "heart" | "save" | "share" | "arrow";

function Icon({ name }: { name: IconName }) {
  const paths = {
    back: <path d="m15 18-6-6 6-6" />,
    muted: <><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="m22 9-6 6m0-6 6 6" /></>,
    volume: <><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8 8 0 0 1 0 12" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    save: <path d="M5 3h14v18l-7-4-7 4V3Z" />,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  }[name];
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths}</svg>;
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
  }
}

function storageKey(type: "like" | "save", id: number) {
  return `tripanza_meta_reel_${type}_${id}`;
}

export default function MetaReelsFeed({ items, initialIndex }: { items: MetaReel[]; initialIndex: number }) {
  const router = useRouter();
  const start = Math.max(0, Math.min(items.length - 1, initialIndex));
  const feedRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const tapRef = useRef<{ index: number; at: number; timer: number | null }>({ index: -1, at: 0, timer: null });
  const toastTimerRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(start);
  const [soundOn, setSoundOn] = useState(false);
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [burstId, setBurstId] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const notify = useCallback((message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 1700);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const likedIds = new Set<number>();
      const savedIds = new Set<number>();
      for (const item of items) {
        try {
          if (window.localStorage.getItem(storageKey("like", item.id)) === "1") likedIds.add(item.id);
          if (window.localStorage.getItem(storageKey("save", item.id)) === "1") savedIds.add(item.id);
        } catch { /* Browser storage can be disabled. */ }
      }
      setLiked(likedIds);
      setSaved(savedIds);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || !items.length) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.65) continue;
        const index = Number((entry.target as HTMLElement).dataset.index || 0);
        setActiveIndex(index);
      }
    }, { root: feed, threshold: [0.65] });
    for (const child of Array.from(feed.children)) observer.observe(child);
    const frame = window.requestAnimationFrame(() => feed.children[start]?.scrollIntoView({ block: "start" }));
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [items.length, start]);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      video.muted = !soundOn;
      if (index === activeIndex) void video.play().catch(() => undefined);
      else video.pause();
    });
    const active = items[activeIndex];
    if (active) {
      const url = new URL(window.location.href);
      url.searchParams.set("reel", String(active.id));
      window.history.replaceState({}, "", url);
    }
  }, [activeIndex, items, soundOn]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        feedRef.current?.children[Math.min(items.length - 1, activeIndex + 1)]?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        feedRef.current?.children[Math.max(0, activeIndex - 1)]?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (event.key.toLowerCase() === "m") {
        setSoundOn((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, items.length]);

  useEffect(() => () => {
    if (tapRef.current.timer) window.clearTimeout(tapRef.current.timer);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  function persist(type: "like" | "save", id: number, value: boolean) {
    try { window.localStorage.setItem(storageKey(type, id), value ? "1" : "0"); } catch { /* Optional enhancement. */ }
  }

  function toggleLike(id: number, forceOn = false) {
    setLiked((current) => {
      const next = new Set(current);
      const nextValue = forceOn || !next.has(id);
      if (nextValue) next.add(id); else next.delete(id);
      persist("like", id, nextValue);
      return next;
    });
    if (forceOn) {
      setBurstId(null);
      window.requestAnimationFrame(() => setBurstId(id));
      window.setTimeout(() => setBurstId(null), 720);
    }
  }

  function toggleSave(id: number) {
    setSaved((current) => {
      const next = new Set(current);
      const nextValue = !next.has(id);
      if (nextValue) next.add(id); else next.delete(id);
      persist("save", id, nextValue);
      notify(nextValue ? "Saved for later" : "Removed from saved");
      return next;
    });
  }

  function videoTap(index: number, now: number) {
    const previous = tapRef.current;
    if (previous.index === index && now - previous.at < 290) {
      if (previous.timer) window.clearTimeout(previous.timer);
      tapRef.current = { index: -1, at: 0, timer: null };
      toggleLike(items[index].id, true);
      return;
    }
    const timer = window.setTimeout(() => {
      const video = videoRefs.current[index];
      if (!video) return;
      if (video.paused) void video.play().catch(() => undefined); else video.pause();
    }, 300);
    tapRef.current = { index, at: now, timer };
  }

  async function share(item: MetaReel) {
    const url = new URL(window.location.href);
    url.searchParams.set("reel", String(item.id));
    const data = { title: item.title, text: "Watch this Tripanza trip moment", url: url.toString() };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        notify("Link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("Could not share this reel");
    }
  }

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  if (!items.length) {
    return <main className="tmr-app"><div className="tmr-stage"><div className="tmr-empty"><span aria-hidden="true">▶</span><h1>Fresh trip drops soon</h1><p>We are collecting the next batch of real group-trip moments.</p><Link href="/tours">Explore Tripanza</Link></div></div></main>;
  }

  return <main className="tmr-app">
    <div className="tmr-stage">
      <div ref={feedRef} className="tmr-feed">
        {items.map((item, index) => {
          const active = index === activeIndex;
          const nearby = Math.abs(index - activeIndex) <= 1;
          return <article className={`tmr-reel${active ? " is-active" : ""}`} data-index={index} key={item.id} aria-label={`Trip reel ${index + 1} of ${items.length}: ${item.title}`}>
            <video ref={(node) => { videoRefs.current[index] = node; }} className="tmr-video" src={nearby ? item.video : undefined} poster={item.cover || undefined} muted={!soundOn} loop playsInline preload={active ? "auto" : "metadata"} onClick={(event) => videoTap(index, event.timeStamp)} />
            <span className={`tmr-heart${burstId === item.id ? " show" : ""}`} aria-hidden="true"><Icon name="heart" /></span>
            <header className="tmr-top"><button type="button" className="tmr-icon" onClick={goBack} aria-label="Go back"><Icon name="back" /></button><button type="button" className="tmr-icon" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "Turn sound off" : "Turn sound on"}><Icon name={soundOn ? "volume" : "muted"} /></button></header>
            <div className="tmr-actions">
              <button type="button" className={`tmr-action${liked.has(item.id) ? " is-active is-liked" : ""}`} onClick={() => toggleLike(item.id)} aria-pressed={liked.has(item.id)}><i><Icon name="heart" /></i><span>Like</span></button>
              <button type="button" className={`tmr-action${saved.has(item.id) ? " is-active" : ""}`} onClick={() => toggleSave(item.id)} aria-pressed={saved.has(item.id)}><i><Icon name="save" /></i><span>Save</span></button>
              <button type="button" className="tmr-action" onClick={() => void share(item)}><i><Icon name="share" /></i><span>Share</span></button>
            </div>
            <div className="tmr-copy">
              <div className="tmr-partner"><img src={item.logo || DEFAULT_PARTNER_LOGO} alt={`${item.company} logo`} width="36" height="36" onError={(event) => { const image = event.currentTarget; if (!image.src.endsWith("cropped-Tripanza-Logo-11.png")) image.src = DEFAULT_PARTNER_LOGO; else image.hidden = true; }} /><span><strong>{item.company}<b aria-label="Verified">✓</b></strong><small>Community group experience</small></span></div>
              <h1 className="tmr-title">{item.title}</h1>
              <div className="tmr-meta">{item.rating > 0 ? <span>★ {item.rating.toFixed(1)}{item.reviews ? ` · ${item.reviews}` : ""}</span> : null}{item.duration ? <span>{item.duration}</span> : null}{item.address ? <span>{item.address}</span> : null}<span>18–28 community</span></div>
              <div className="tmr-cta"><div className="tmr-price"><small>{item.price ? "Starts from" : "Your next group trip"}</small><strong>{item.oldPrice > item.price && item.price ? <del>{money(item.oldPrice, item.currency)}</del> : null}{item.price ? money(item.price, item.currency) : "See trip details"}</strong></div><Link href={`/tours/${item.tourSlug}`}>Explore trip <Icon name="arrow" /></Link></div>
            </div>
          </article>;
        })}
      </div>
    </div>
    <div className={`tmr-toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
  </main>;
}
