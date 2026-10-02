"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HostProfile, HostReel, HostTour } from "@/lib/host";
import HostProfileExtras from "./HostProfileExtras";
import HostProfileCamera from "./HostProfileCamera";
import HostProfileDock from "./HostProfileDock";
import HostProfileEditorial from "./HostProfileEditorial";
import HostOriginalMenu from "./HostOriginalMenu";
import HostProfileEditor from "./HostProfileEditor";
import { hostThemes, hostThemeStyle } from "./profile-themes";
import "./profile-original.css";



export default function HostProfileView({ initial, reels, owner, notice = "" }: { initial: HostProfile; reels: HostReel[]; owner: boolean; notice?: string }) {
  const [profile, setProfile] = useState(initial);
  const [message, setMessage] = useState(notice);
  const [editing, setEditing] = useState(false);
  const [dark, setDark] = useState(false);
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone || "");
  const [tagline, setTagline] = useState(initial.tagline);
  const [bio, setBio] = useState(initial.bio);
  const [instagram, setInstagram] = useState(initial.instagram);
  const [theme, setTheme] = useState(initial.theme);
  const [font, setFont] = useState(initial.font || "default");
  const [palette, setPalette] = useState(initial.palette || {});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [itineraryTrip, setItineraryTrip] = useState<HostTour | null>(null);
  const [itineraryEmail, setItineraryEmail] = useState("");
  const [itineraryPhone, setItineraryPhone] = useState("");
  const [itineraryError, setItineraryError] = useState("");
  const [itineraryBusy, setItineraryBusy] = useState(false);
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
      const response = await fetch("/api/host/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone, tagline, bio, instagram, theme, font, palette }) });
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

  async function downloadItinerary(event: React.FormEvent) {
    event.preventDefault();
    if (!itineraryTrip) return;
    setItineraryBusy(true); setItineraryError("");
    try {
      const response = await fetch("/api/itinerary-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tourId: itineraryTrip.id, email: itineraryEmail, phone: itineraryPhone }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your details.");
      const pdfUrl = itineraryTrip.pdf_url;
      setItineraryTrip(null);
      if (pdfUrl) window.location.assign(pdfUrl);
      else setMessage("Your request was saved. Open the trip to download its itinerary.");
    } catch (caught) { setItineraryError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setItineraryBusy(false); }
  }

  return <div className="host-system">{owner && <HostOriginalMenu profile={profile} />}<main className="tp-host" data-host-style={hostThemes[profile.theme]?.style || "classic"} data-host-dark={dark ? "1" : "0"} style={hostThemeStyle(profile.theme, profile.palette || {}, profile.font)}>
    <section className="tp-host-hero"><div className={`tp-host-cover ${profile.cover ? "" : "is-default"}`} style={{ backgroundImage: `url(${profile.cover || "https://tripanza.com/wp-content/uploads/2026/09/0ba194b9-5683-4b3d-a91c-0712c09fcfac.png"})` }}><div className="tp-host-cover__shade" />{message && <div className="tp-host-toast" role="status"><span>✓</span><strong>{message}</strong></div>}<div className="tp-host-cover__top"><span className="tp-host-live"><i />{profile.trip_count ? `${profile.trip_count} TRIPS LIVE` : "HOST PROFILE"}</span><div className="tp-host-cover__actions"><button type="button" className="tp-host-glass tp-host-theme-toggle" aria-pressed={dark} aria-label={dark ? "Disable dark mode" : "Enable dark mode"} onClick={() => setDark(current => !current)}>☾ <span>{dark ? "Light" : "Dark"}</span></button>{owner ? <button type="button" className="tp-host-glass" onClick={() => setEditing(true)}>✎ Edit profile</button> : <button type="button" className="tp-host-glass" onClick={() => navigator.share ? navigator.share({ title: profile.name, url: window.location.href }).catch(() => {}) : navigator.clipboard?.writeText(window.location.href)}>↗ Share</button>}</div></div></div>
    <div className="tp-host-identity"><div className={`tp-host-avatar ${profile.logo ? "has-logo" : ""}`}>{profile.logo ? <img src={profile.logo} alt={`${profile.name} logo`} /> : <span>{profile.name.slice(0,1)}</span>}</div>{profile.verified && <span className="tp-host-verified">✓ Trusted host</span>}<h1>{profile.name}</h1>{profile.tagline && <p className="tp-host-tagline">{profile.tagline}</p>}{profile.bio && <p className="tp-host-bio">{profile.bio}</p>}<div className="tp-host-stats"><div><strong>{profile.trip_count}</strong><small>Live trips</small></div><div><strong>{profile.rating ? `${profile.rating.toFixed(1)} ★` : "New"}</strong><small>Host rating</small></div><div><strong>0</strong><small>Reviews</small></div></div>{profile.instagram && <a className="tp-host-social" href={profile.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>}</div></section>
    <section className="tp-host-trips" id="tpHostTrips"><header className="tp-host-trips__head"><div><span className="tp-host-kicker">PICK YOUR CHAOS</span><h2>Trips by <em>{profile.name}</em></h2></div>{owner && <Link href="/admin-host-trips">Manage <span>→</span></Link>}</header>{destinations.length > 1 && <nav className="tp-host-filters" aria-label="Filter trips"><button type="button" className={filter === "all" ? "is-active" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All trips</button>{destinations.map(destination => <button type="button" className={filter === destination ? "is-active" : ""} aria-pressed={filter === destination} onClick={() => setFilter(destination)} key={destination}>{destination}</button>)}</nav>}
    <div className="tp-host-trip-grid">{trips.length ? trips.map(trip => <article className="tp-host-trip" key={trip.id}><Link className="tp-host-trip__media" href={`/tours/${trip.slug}`}>{trip.image && <img src={trip.image} alt={trip.title} />}<span className="tp-host-trip__wash" />{trip.sold_out ? <span className="tp-host-trip__sold">SOLD OUT</span> : trip.premium ? <span className="tp-host-trip__premium">✦ MOST WANTED</span> : null}{!!trip.rating && <span className="tp-host-trip__rating">★ {trip.rating.toFixed(1)}{trip.reviews ? ` (${trip.reviews})` : ""}</span>}</Link><div className="tp-host-trip__body"><span className="tp-host-kicker">{trip.sold_out ? "CREW FULL" : "CREW FORMING"}</span><h3><Link href={`/tours/${trip.slug}`}>{trip.title}</Link></h3><div className="tp-host-trip__meta"><span>◷ {trip.duration || "Live trip"} days</span><span>⌖ {trip.address || "India"}</span></div><div className="tp-host-trip__foot"><div><small>{trip.price ? "Starts from" : "Price"}</small><strong>{trip.price ? `₹${trip.price.toLocaleString("en-IN")}` : "Check dates"}</strong></div><button type="button" aria-label="Download itinerary PDF" title="Download itinerary PDF" onClick={() => { setItineraryTrip(trip); setItineraryError(""); }}>↓ <span>PDF</span></button><Link href={`/tours/${trip.slug}`} aria-label={`Open ${trip.title}`}>→</Link></div></div></article>) : <div className="tp-host-no-trips"><span>✦</span><h3>Fresh page.<br />Trips loading soon.</h3><p>This host hasn’t published a public trip yet.</p>{owner && <Link href="/admin-host-trips">Add your first trip <b>→</b></Link>}</div>}</div></section>
    {owner && <div className="tp-host-owner-strip"><span><b>{profile.trip_count}</b> live trips</span><Link href="/host-customer-booking-history">View trip bookings <b>→</b></Link></div>}
    <HostProfileExtras profile={profile} />
    <HostProfileCamera trips={profile.trips} />
    {!!reels.length && <section className="tp-host-reel-section"><div className="tp-host-reel-section__head"><span>No brochure energy</span><h2>Watch the vibe before you commit.</h2></div><div className="tp-host-reel-rail" aria-label="Trip reels">{reels.slice(0, 6).map(item => <Link className="tp-host-reel" href={`/host/${profile.slug}/reels`} key={item.id} aria-label={`Watch ${item.title || item.tour.title} reel`}><video src={item.video} poster={item.tour.image} muted loop playsInline preload="metadata" aria-hidden="true" /><span className="tp-host-reel__shade" /><span className="tp-host-reel__play" aria-hidden="true">▶</span><span className="tp-host-reel__copy"><small>{item.tour.duration} days</small><strong>{item.title || item.tour.title}</strong></span></Link>)}</div></section>}
    <HostProfileEditorial slug={profile.slug} helpUrl={profile.help_whatsapp_url} />
  </main><HostProfileDock profile={profile} dark={dark} />{itineraryTrip && <div className="tp-host-sheet is-open" role="dialog" aria-modal="true" aria-labelledby="tpHostItineraryTitle"><form className="tp-host-sheet__panel" onSubmit={downloadItinerary}><button type="button" className="tp-host-sheet__close" aria-label="Close" onClick={() => setItineraryTrip(null)}>×</button><span className="tp-host-kicker">TAKE THE PLAN WITH YOU</span><h3 id="tpHostItineraryTitle">Send me the itinerary.</h3><p>Drop your details and the complete trip plan is yours.</p><label>Email address<input type="email" value={itineraryEmail} onChange={event => setItineraryEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label><label>WhatsApp number<input type="tel" value={itineraryPhone} onChange={event => setItineraryPhone(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" required /></label><div className="tp-host-sheet__message" role="status">{itineraryError}</div><button type="submit" className="tp-host-sheet__submit" disabled={itineraryBusy}>{itineraryBusy ? "Preparing…" : "Get itinerary"} <span>→</span></button></form></div>}{editing && <HostProfileEditor profile={profile} name={name} setName={setName} phone={phone} setPhone={setPhone} tagline={tagline} setTagline={setTagline} bio={bio} setBio={setBio} instagram={instagram} setInstagram={setInstagram} theme={theme} setTheme={setTheme} font={font} setFont={setFont} palette={palette} setPalette={setPalette} setLogoFile={setLogoFile} setCoverFile={setCoverFile} error={error} busy={busy} dark={dark} onClose={() => setEditing(false)} onSave={save} />}</div>;
}
