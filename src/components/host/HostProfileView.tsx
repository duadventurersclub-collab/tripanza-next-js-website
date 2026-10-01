"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HostProfile, HostReel } from "@/lib/host";
import HostProfileExtras from "./HostProfileExtras";

const themes = ["default", "aurora-club", "desert-club", "dopamine-pop", "alpine-luxe", "y2k-chrome", "retro-postcard", "custom"];

export default function HostProfileView({ initial, reels, owner, notice = "" }: { initial: HostProfile; reels: HostReel[]; owner: boolean; notice?: string }) {
  const [profile, setProfile] = useState(initial);
  const [message, setMessage] = useState(notice);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone || "");
  const [tagline, setTagline] = useState(initial.tagline);
  const [bio, setBio] = useState(initial.bio);
  const [instagram, setInstagram] = useState(initial.instagram);
  const [theme, setTheme] = useState(initial.theme);
  const [palette, setPalette] = useState(initial.palette || {});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const trips = filter === "all" ? profile.trips : profile.trips.filter(trip => trip.address.toLowerCase().includes(filter));
  const destinations = Array.from(new Set(profile.trips.map(trip => trip.address.toLowerCase()).filter(Boolean))).slice(0, 6);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("confirm_host_identity")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/host/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone, tagline, bio, instagram, theme, palette }) });
      let data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Could not save profile.");
      const identityReviewRequested = Boolean(data.identity_review_requested);
      for (const [kind, file] of [["logo", logoFile], ["cover", coverFile]] as const) {
        if (!file) continue;
        const form = new FormData(); form.set("kind", kind); form.set("image", file);
        const upload = await fetch("/api/host/media", { method: "POST", body: form });
        data = await upload.json();
        if (!upload.ok) throw new Error(data.message || data.error || `Could not upload ${kind}.`);
      }
      setProfile(data.profile); setEditing(false);
      setMessage(identityReviewRequested ? "Profile saved. Check your email to confirm the name or phone change; Tripanza will review it before it appears publicly." : "Profile saved.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <div className="host-system" data-host-style={profile.theme} style={profile.theme === "custom" ? { "--hb": profile.palette.primary || "#3157d5", "--hl": profile.palette.accent || "#d0e562", "--hi": profile.palette.ink || "#151925", background: profile.palette.background || "#f8f9fc" } as React.CSSProperties : undefined}><header className="hs-top"><Link className="hs-wordmark" href="/"><span>T</span> Tripanza</Link>{owner && <Link style={{ marginLeft: "auto" }} className="host-text-link" href="/host-dashboard">Host dashboard →</Link>}</header>{message && <p className="host-notice" role="status">{message}</p>}<div className="host-profile-cover" style={profile.cover ? { backgroundImage: `linear-gradient(180deg,#09133340,#09133360),url(${profile.cover})` } : undefined} /><section className="host-profile-head"><div className="host-profile-logo">{profile.logo ? <img src={profile.logo} alt="" /> : profile.name.slice(0, 1)}</div>{profile.verified && <span className="host-eyebrow">✓ VERIFIED HOST</span>}<h1>{profile.name}</h1>{profile.tagline && <strong style={{ color: "var(--hb)" }}>{profile.tagline}</strong>}<p>{profile.bio || "Real trips. Great people. Your next crew starts here."}</p><div className="host-profile-stats"><span><strong>{profile.trip_count}</strong><br />Live trips</span><span><strong>{profile.rating ? profile.rating.toFixed(1) : "New"}</strong><br />Host rating</span></div><div className="host-actions" style={{ justifyContent: "center" }}>{profile.instagram && <a className="host-text-link" href={profile.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>}{owner && <button className="host-button" type="button" onClick={() => setEditing(true)}>Edit profile <span>✎</span></button>}<button className="host-button blue" type="button" onClick={() => navigator.share ? navigator.share({ title: profile.name, url: window.location.href }).catch(() => {}) : navigator.clipboard?.writeText(window.location.href)}>Share profile <span>↗</span></button></div></section>
    <main className="host-shell"><section className="host-section"><div className="host-section-head"><div><span className="host-eyebrow">PICK YOUR CHAOS</span><h2>Trips by <em>{profile.name}.</em></h2></div></div>{destinations.length > 1 && <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 18 }}><button type="button" className="host-button" style={{ minHeight: 35 }} onClick={() => setFilter("all")}>All</button>{destinations.map(destination => <button type="button" key={destination} className="host-button" style={{ minHeight: 35, background: filter === destination ? "#d0e562" : "#fff" }} onClick={() => setFilter(destination)}>{destination}</button>)}</div>}{trips.length ? <div className="host-grid">{trips.map(trip => <article className="host-card" key={trip.id}><Link href={`/tours/${trip.slug}`}>{trip.image && <img src={trip.image} alt="" />}</Link><div className="host-card-body"><span className="host-eyebrow">CREW READY</span><h3><Link href={`/tours/${trip.slug}`}>{trip.title}</Link></h3><p>{trip.duration} days · {trip.address || "India"}</p><div className="host-card-foot"><span>{trip.selected_dates.length} hosted dates</span><Link href={`/tours/${trip.slug}`}>Explore →</Link></div></div></article>)}</div> : <div className="host-empty"><h3>Fresh page. Trips loading soon.</h3><p>This host hasn&apos;t published a public trip yet.</p>{owner && <Link className="host-button" href="/admin-host-trips">Add your first trip <span>→</span></Link>}</div>}</section>
      <HostProfileExtras profile={profile} />
      {reels.length > 0 && <section className="host-section"><div className="host-section-head"><div><span className="host-eyebrow">REAL TRIP MOMENTS</span><h2>Watch the <em>vibe.</em></h2></div><Link className="host-text-link" href={`/host/${profile.slug}/reels`}>All reels →</Link></div><div className="host-grid four">{reels.slice(0, 4).map(item => <Link className="host-card" href={`/host/${profile.slug}/reels`} key={item.id}><video src={item.video} poster={item.tour.image} muted playsInline preload="metadata" style={{ width: "100%", height: 260, objectFit: "cover", background: "#111" }} /><div className="host-card-body"><h3>{item.tour.title}</h3><span className="host-text-link">Watch reel →</span></div></Link>)}</div></section>}
      <section className="host-section"><div className="host-banner"><div><span className="host-eyebrow" style={{ color: "#d0e562" }}>YOUR NEXT CREW</span><h2>Stop reacting to reels.<br />Go make one.</h2><p>Explore hosted trips and choose your departure.</p></div><a className="host-button" href="#top" onClick={event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Explore trips <span>↑</span></a></div></section>
    </main>{editing && <div className="host-modal" role="dialog" aria-modal="true" aria-label="Edit host profile"><div className="host-modal-panel"><button className="host-modal-close" type="button" onClick={() => setEditing(false)} aria-label="Close">×</button><span className="host-eyebrow">PUBLIC HOST IDENTITY</span><h2>Make it yours.</h2><p>Updates to your name, imagery and theme appear on your public page. Verified name or phone changes require email confirmation and review.</p><form className="host-form" onSubmit={save}><label>Host name<input value={name} onChange={event => setName(event.target.value)} required minLength={2} /></label><label>Phone number<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} required /></label><label>Tagline<input value={tagline} onChange={event => setTagline(event.target.value)} /></label><label>About your community<textarea value={bio} onChange={event => setBio(event.target.value)} /></label><label>Instagram URL<input type="url" value={instagram} onChange={event => setInstagram(event.target.value)} /></label><label>Theme<select value={theme} onChange={event => setTheme(event.target.value)}>{themes.map(value => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}</select></label>{theme === "custom" && ["primary", "accent", "ink", "background"].map(key => <label key={key}>{key} colour<input type="color" value={palette[key] || "#3157d5"} onChange={event => setPalette(current => ({ ...current, [key]: event.target.value }))} /></label>)}<label>Logo image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setLogoFile(event.target.files?.[0] || null)} /></label><label>Cover image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setCoverFile(event.target.files?.[0] || null)} /></label>{error && <p className="host-error" role="alert">{error}</p>}<button className="host-button blue" type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}<span>→</span></button></form></div></div>}</div>;
}
