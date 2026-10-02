"use client";

import Link from "next/link";
import { useState } from "react";
import type { HostReel, HostTour } from "@/lib/host";
import "./reels-studio-original.css";

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
  return <main className="tr-studio"><header className="tr-topbar"><span className="tr-menu-space" aria-hidden="true" /><Link className="tr-brand" href={`/host/${slug}`}><span>HOST MODE</span><strong>{slug.replaceAll("-"," ")}</strong></Link><Link className="tr-round" href={`/host/${slug}/reels`} aria-label="View live reels">▶</Link></header>
    <section className="tr-hero"><div><span className="tr-kicker"><i /> CREATOR CONTROL ROOM</span><h1>Drop the moment.<br /><em>Fill the next trip.</em></h1><p>Turn raw trip energy into the reel that makes someone say, “okay, I’m coming.”</p></div><div className="tr-score"><div><strong>{items.length}</strong><small>Live drops</small></div><div><strong>{tours.length}</strong><small>Trips ready</small></div></div></section>
    <section className="tr-workbench"><form className="tr-form" onSubmit={upload}><div className="tr-form-head"><div><span>01</span><h2>Build your drop</h2></div><small>9:16 works best</small></div><label className="tr-label" htmlFor="tr-tour">Which trip is this energy from?</label><div className="tr-select"><span>▲</span><select id="tr-tour" value={tourId} onChange={event => setTourId(Number(event.target.value))} disabled={!tours.length}>{!tours.length && <option value="0">Choose a live trip</option>}{tours.map(tour => <option key={tour.id} value={tour.id}>{tour.title}</option>)}</select><span>⌄</span></div>
    <div className="tr-picker"><span>⇧</span><strong>Choose your vertical video</strong><small>MP4, MOV, M4V or WebM · maximum 60 seconds and 50 MB</small><label htmlFor="tr-file-input">Choose video</label><input id="tr-file-input" type="file" accept="video/mp4,video/x-m4v,video/quicktime,video/webm" onChange={event => void chooseVideo(event.target.files?.[0] || null)} /></div>{video && <div className="tr-file"><span>✓</span><div><strong>{video.name}</strong><small>Ready for the feed · {(video.size/1024/1024).toFixed(1)} MB</small></div><button type="button" onClick={() => setVideo(null)} aria-label="Remove video">×</button></div>}
    <label className="tr-label" htmlFor="tr-title">Reel title (optional)</label><input id="tr-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="A moment from the trip" />{checking && <p className="tr-error">Checking video length…</p>}{error && <p className="tr-error" role="alert">{error}</p>}{notice && <p className="tr-toast" role="status">{notice}</p>}{tours.length ? <button className="tr-publish" type="submit" disabled={busy || checking}><b>{busy ? `Uploading your video… ${progress}%` : "Publish reel"}</b><i>→</i></button> : <Link className="tr-publish" href="/admin-host-trips"><b>Choose a trip first</b><i>→</i></Link>}{busy && <progress value={progress} max={100} aria-label="Video upload progress" style={{ width: "100%" }} />}<div className="tr-rules"><span>REAL</span><span>VERTICAL</span><span>60 SEC MAX</span><span>50 MB MAX</span></div></form>
    <aside className="tr-phone"><div className="tr-screen">{items[0] && <video src={items[0].video} poster={items[0].tour.image} muted loop playsInline preload="metadata" />}<div className="tr-poster"><span>▶</span><strong>Your reel<br />lands here.</strong><small>Pick a trip + video</small></div><div className="tr-phone-ui"><b>TRIPANZA DROP</b><div><strong>{tours.find(tour => tour.id === tourId)?.title || "Next crew loading…"}</strong><span>Watch. Vibe. Book.</span></div></div></div></aside></section>
    <section className="tr-library"><div className="tr-library-head"><div><span className="tr-kicker">YOUR DROP ZONE</span><h2>Live reels</h2></div><small>{items.length} reels</small></div>{items.length ? <div className="tr-grid">{items.map((item,index) => <article className="tr-card" key={item.id}><div className="tr-card-media"><video src={item.video} poster={item.tour.image} controls playsInline preload="metadata" /><span>DROP {String(index+1).padStart(2,"0")}</span><b>● LIVE</b></div><div className="tr-card-body"><small>{item.date?.slice(0,10)}</small><h3>{item.tour.title}</h3><div><Link href={`/tours/${item.tour.slug}`}>View trip ↗</Link><button type="button" disabled={busy} onClick={() => remove(item.id)}>Delete</button></div></div></article>)}</div> : <div className="tr-empty"><span>▶</span><h3>Your first drop is waiting.</h3><p>Choose one real moment—the laugh, the view, the chaos—and ship it.</p><button type="button" onClick={() => document.querySelector(".tr-workbench")?.scrollIntoView({ behavior: "smooth" })}>Make the first reel</button></div>}</section>
  </main>;
}
