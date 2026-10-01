"use client";

import Link from "next/link";
import { useState } from "react";
import type { HostReel, HostTour } from "@/lib/host";

export default function HostReelsManager({ initial, tours, slug }: { initial: HostReel[]; tours: HostTour[]; slug: string }) {
  const [items, setItems] = useState(initial);
  const [tourId, setTourId] = useState(tours[0]?.id || 0);
  const [video, setVideo] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function chooseVideo(file: File | null) {
    setVideo(null); setError(""); setProgress(0);
    if (!file) return;
    if (file.size < 1 || file.size > 50 * 1024 * 1024 || !/\.(mp4|m4v|mov|webm)$/i.test(file.name)) {
      setError("Choose an MP4, M4V, MOV or WebM video smaller than 50 MB."); return;
    }
    setChecking(true);
    const url = URL.createObjectURL(file);
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.onloadedmetadata = () => resolve(probe.duration);
        probe.onerror = () => reject(new Error("We could not read this video."));
        probe.src = url;
      });
      if (!Number.isFinite(duration) || duration <= 0 || duration > 60.25) throw new Error("Choose a video that is 60 seconds or shorter.");
      setVideo(file);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Choose another video."); }
    finally { URL.revokeObjectURL(url); setChecking(false); }
  }

  function sendVideo(form: FormData): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/host/reels");
      xhr.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.min(99, Math.round(event.loaded / event.total * 100))); };
      xhr.onload = () => {
        let payload: { message?: string; error?: string } = {};
        try { payload = JSON.parse(xhr.responseText); } catch { /* Show the fallback below. */ }
        if (xhr.status >= 200 && xhr.status < 300) { setProgress(100); resolve(); }
        else reject(new Error(payload.message || payload.error || `Upload failed (HTTP ${xhr.status}).`));
      };
      xhr.onerror = () => reject(new Error("The upload connection was interrupted. Please try again."));
      xhr.send(form);
    });
  }

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!tourId || !video || checking) { setError("Choose a trip and wait for the video check to finish."); return; }
    if (video.size > 50 * 1024 * 1024) { setError("Choose a video smaller than 50 MB."); return; }
    setBusy(true); setError(""); setNotice(""); setProgress(0);
    try {
      const form = new FormData(); form.set("tour_id", String(tourId)); form.set("title", title); form.set("video", video);
      await sendVideo(form);
      const refresh = await fetch("/api/host/reels", { cache: "no-store" });
      const listing = await refresh.json();
      setItems(listing.items || []); setVideo(null); setTitle(""); setNotice("Your reel is live.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!window.confirm("Move this reel to trash? An admin can recover it.")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/host/reels/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Could not delete the reel.");
      setItems(current => current.filter(item => item.id !== id)); setNotice("Reel moved to trash.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <><div className="host-toolbar"><div><span className="host-eyebrow">CREATOR CONTROL ROOM</span><h1 className="host-title">Drop the moment.<br /><em>Fill the next trip.</em></h1><p className="host-copy">Turn raw trip energy into the reel that makes someone say “okay, I&apos;m coming.”</p></div><Link className="host-text-link" href={`/host/${slug}/reels`}>View public feed →</Link></div>
    <section className="host-panel" style={{ maxWidth: 700 }}><h2>Build your drop</h2><p className="host-copy">Vertical 9:16 works best. MP4, M4V, MOV or WebM up to 50 MB.</p>{!tours.length ? <div className="host-empty"><h3>Choose a trip first</h3><p>Reels connect to one of your live hosted trips.</p><Link className="host-button" href="/admin-host-trips">Pick a trip <span>→</span></Link></div> : <form className="host-form" onSubmit={upload}><label>Linked trip<select value={tourId} onChange={event => setTourId(Number(event.target.value))}>{tours.map(tour => <option key={tour.id} value={tour.id}>{tour.title}</option>)}</select></label><label>Reel title (optional)<input value={title} onChange={event => setTitle(event.target.value)} placeholder="A moment from the trip" /></label><label>Vertical video<input type="file" accept="video/mp4,video/x-m4v,video/quicktime,video/webm" onChange={event => void chooseVideo(event.target.files?.[0] || null)} /></label>{checking && <p className="host-copy">Checking video length…</p>}{video && <p className="host-copy">{video.name} · {(video.size / 1024 / 1024).toFixed(1)} MB</p>}{busy && <progress value={progress} max={100} aria-label="Video upload progress" style={{ width: "100%" }} />}{error && <p className="host-error" role="alert">{error}</p>}{notice && <p className="host-success" role="status">{notice}</p>}<button type="submit" className="host-button blue" disabled={busy || checking}>{busy ? `Uploading your video… ${progress}%` : "Publish reel"}<span>→</span></button></form>}</section>
    <section className="host-section"><div className="host-section-head"><div><span className="host-eyebrow">YOUR DROP ZONE</span><h2>Live <em>reels.</em></h2></div><small>{items.length} reels</small></div>{items.length ? <div className="host-grid four">{items.map(item => <article className="host-card" key={item.id}><video src={item.video} poster={item.tour.image} controls playsInline preload="metadata" style={{ width: "100%", height: 320, objectFit: "cover", background: "#111" }} /><div className="host-card-body"><small>{item.date?.slice(0, 10)}</small><h3>{item.tour.title}</h3><div className="host-card-foot"><Link href={`/tours/${item.tour.slug}`}>View trip ↗</Link><button style={{ border: 0, background: "none", color: "#bd2947", cursor: "pointer" }} type="button" disabled={busy} onClick={() => remove(item.id)}>Delete</button></div></div></article>)}</div> : <div className="host-empty"><h3>Your first drop is waiting.</h3><p>Choose one real moment and publish it.</p></div>}</section>
  </>;
}
