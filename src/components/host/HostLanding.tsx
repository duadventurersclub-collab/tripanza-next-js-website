"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HostSummary, HostTour } from "@/lib/host";

async function post(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`/api/host/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || "Please try again.");
  return data;
}

type Leader = { id: number; name: string; slug: string; revenue: number; earnings: number; bookings: number };

export default function HostLanding({ trips, hosts, leaderboard, signedIn, isHost, openInitially }: { trips: HostTour[]; hosts: HostSummary[]; leaderboard: Leader[]; signedIn: boolean; isHost: boolean; openInitially: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(openInitially && signedIn && !isHost);
  const [people, setPeople] = useState(10);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [gst, setGst] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function start() {
    if (isHost) { router.push("/host-dashboard"); return; }
    if (!signedIn) { router.push("/login?next=%2Fhost%3Fregister%3D1"); return; }
    setOpen(true);
  }

  async function submit() {
    setBusy(true); setError("");
    try {
      if (step === 0) {
        if (name.trim().length < 2) throw new Error("Enter a host or community name.");
        setStep(1);
      } else if (step === 1 && !ticket) {
        if (!code) { await post("registration/send-code", { email }); setStep(2); }
        else { const data = await post("registration/verify-code", { email, code }); setTicket(data.ticket); setStep(3); }
      } else if (step === 2) {
        const data = await post("registration/verify-code", { email, code }); setTicket(data.ticket); setStep(3);
      } else {
        if (!terms) throw new Error("Accept the Tripanza Host Policies to continue.");
        await post("registration", { name, email, phone, instagram, gst, ticket, accept_terms: true });
        if (logo) {
          const form = new FormData(); form.set("kind", "logo"); form.set("image", logo);
          const response = await fetch("/api/host/media", { method: "POST", body: form });
          if (!response.ok) {
            router.push("/host-dashboard?setup=logo"); router.refresh();
            return;
          }
        }
        router.push("/host-dashboard"); router.refresh();
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <div className="host-system"><header className="hs-top"><Link className="hs-wordmark" href="/"><span>T</span> Tripanza</Link><button className="host-button" type="button" onClick={start}>{isHost ? "Host dashboard" : "Become a host"}<span>→</span></button></header><main className="host-shell">
    <section className="host-hero"><div><span className="host-eyebrow">BUILD THE CREW</span><h1 className="host-title">Your people.<br />Your trip.<br /><em>Your upside.</em></h1><p className="host-copy">Bring the community. Tripanza brings the itinerary, operations and booking tech. You host the energy—and earn when your people book.</p><div className="host-actions"><button type="button" className="host-button" onClick={start}>{isHost ? "Open host dashboard" : "Claim host mode"}<span>→</span></button><a className="host-text-link" href="#how">See how it works ↓</a></div></div><div className="host-hero-art" aria-hidden="true" /></section>
    <section className="host-section" id="how"><div className="host-section-head"><div><span className="host-eyebrow">HOSTING, DECOMPLICATED</span><h2>Four moves.<br /><em>One live crew.</em></h2></div><p>You focus on the community. Tripanza keeps the booking and operational machinery moving.</p></div><div className="host-grid four">{[["Claim host mode", "Create your profile, add your identity and unlock the host dashboard."], ["Pick the trip", "Choose a ready itinerary and departure that matches your people."], ["Drop the link", "Share your branded trip page, reels and itinerary with the community."], ["Host and earn", "Watch bookings land, host the vibe and receive your eligible payout."]].map(([title, copy], index) => <article className="host-card host-step" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section className="host-section"><div className="host-banner"><div><span className="host-eyebrow" style={{ color: "#d0e562" }}>PLAY WITH THE NUMBERS</span><h2>A full crew can<br />hit different.</h2><p>Illustration based on ₹2,000 estimated earnings per confirmed traveller. Actual margin depends on the trip.</p></div><div className="host-panel" style={{ minWidth: "min(100%, 320px)", color: "#151925" }}><small>ESTIMATED HOST EARNINGS</small><strong style={{ display: "block", fontSize: 36, margin: "13px 0" }}>₹{(people * 2000).toLocaleString("en-IN")}</strong><input style={{ width: "100%" }} aria-label="Travellers" type="range" min="1" max="50" value={people} onChange={event => setPeople(Number(event.target.value))} /><p>{people} travellers · Up to 50</p></div></div></section>
    <section className="host-section"><div className="host-section-head"><div><span className="host-eyebrow">LIVE HOST LEAGUE · THIS MONTH</span><h2>Build crews.<br /><em>Climb the board.</em></h2></div><p>Confirmed bookings this month put the most active hosts on the leaderboard.</p></div>{leaderboard.length ? <div className="host-panel">{leaderboard.map((host, index) => <Link key={host.id} href={`/host/${host.slug}`} style={{ display: "flex", alignItems: "center", gap: 15, padding: 15, borderBottom: "1px solid #edf0f5", color: "#151925" }}><b style={{ color: "#3157d5" }}>#{index + 1}</b><strong style={{ flex: 1 }}>{host.name}</strong><small>{host.bookings} bookings</small><b>₹{Math.round(host.revenue).toLocaleString("en-IN")}</b></Link>)}</div> : <div className="host-empty"><h3>The board is wide open.</h3><p>The first confirmed crews of the month will appear here.</p></div>}</section>
    <section className="host-section"><div className="host-section-head"><div><span className="host-eyebrow">READY FOR YOUR PEOPLE</span><h2>Pick the trip.<br /><em>Add your energy.</em></h2></div><p>Live Tripanza itineraries that can become your next community departure.</p></div>{trips.length ? <div className="host-grid">{trips.slice(0, 6).map(trip => <article className="host-card" key={trip.id}>{trip.image && <Link href={`/tours/${trip.slug}`}><img src={trip.image} alt="" /></Link>}<div className="host-card-body"><h3><Link href={`/tours/${trip.slug}`}>{trip.title}</Link></h3><p>{trip.duration || "Live trip"} days · {trip.address || "India"}</p><Link className="host-card-foot" href={`/tours/${trip.slug}`}>Explore trip <span>→</span></Link></div></article>)}</div> : <div className="host-empty"><h3>New trips are on the way</h3><p>Check back soon for the next host drop.</p></div>}</section>
    {hosts.length > 0 && <section className="host-section"><div className="host-section-head"><div><span className="host-eyebrow">HOST CIRCLE</span><h2>Meet the <em>hosts.</em></h2></div></div><div className="host-grid four">{hosts.slice(0, 8).map(host => <Link className="host-panel" key={host.id} href={`/host/${host.slug}`}><span className="host-profile-logo" style={{ width: 66, height: 66, margin: "0 0 10px" }}>{host.logo ? <img src={host.logo} alt="" /> : host.name[0]}</span><strong>{host.name} {host.verified ? "✓" : ""}</strong><p style={{ color: "#707a8d", fontSize: 11 }}>{host.trip_count} live trips</p></Link>)}</div></section>}
    <section className="host-section"><div className="host-section-head"><div><span className="host-eyebrow">QUESTIONS, ANSWERED STRAIGHT</span><h2>Host with <em>clarity.</em></h2></div></div><div className="host-panel">{[["Do I need to plan the itinerary?", "No. You can choose a Tripanza itinerary and select the dates you want to host."], ["When do I earn?", "Eligible host earnings are based on confirmed bookings. Check your dashboard and wallet for actual amounts."], ["Can I set my own selling price?", "You can add a permitted per-person markup to the departures you select."], ["Who manages bookings?", "Tripanza operates the booking and payment systems. Your host desk shows travellers attributed to your storefront."]].map(([question, answer]) => <details key={question} style={{ padding: 15, borderBottom: "1px solid #e8ecf2" }}><summary style={{ cursor: "pointer", fontWeight: 900 }}>{question}</summary><p className="host-copy">{answer}</p></details>)}</div></section>
    <section className="host-section"><div className="host-banner"><div><h2>Your group chat<br />needs a departure.</h2><p>Claim host mode, choose the trip and start building the crew.</p></div><button className="host-button" type="button" onClick={start}>{isHost ? "Open dashboard" : "Become a host"}<span>→</span></button></div></section>
  </main>{open && <div className="host-modal" role="dialog" aria-modal="true" aria-label="Become a Tripanza Host"><div className="host-modal-panel"><button type="button" className="host-modal-close" onClick={() => setOpen(false)} aria-label="Close">×</button><span className="host-eyebrow">YOUR PUBLIC PROFILE</span><h2>{step === 0 ? "How should travellers recognise you?" : step === 1 ? "Where can we send your code?" : step === 2 ? "Verify your email." : "Finish your host profile."}</h2><p>Step {Math.min(step + 1, 4)} of 4 · Your details help travellers know who they are joining.</p><div className="host-form">{step === 0 && <label>Host or community name<input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="Your host name" /></label>}{step === 1 && <label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></label>}{step === 2 && <><label>Six-digit email code<input inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label><button type="button" className="host-text-link" style={{ border: 0, background: "none", textAlign: "left", cursor: "pointer" }} onClick={async () => { try { await post("registration/send-code", { email }); setError(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Try again."); } }}>Resend code</button></>}{step === 3 && <><label>Phone number with country code<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+91 98765 43210" /></label><label>Host logo (optional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setLogo(event.target.files?.[0] || null)} /></label><label>Instagram or website (optional)<input value={instagram} onChange={event => setInstagram(event.target.value)} placeholder="https://instagram.com/..." /></label><label>GST number (optional)<input value={gst} onChange={event => setGst(event.target.value)} /></label><label style={{ display: "flex", alignItems: "center" }}><input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={terms} onChange={event => setTerms(event.target.checked)} /> I agree to the <Link href="/tnc" target="_blank">Tripanza Host Policies</Link></label></>}{error && <p className="host-error" role="alert">{error}</p>}<button type="button" className="host-button blue" disabled={busy} onClick={submit}>{busy ? "Please wait…" : step === 3 ? "Create host profile" : step === 1 ? "Send code" : step === 2 ? "Verify code" : "Continue"}<span>→</span></button></div></div></div>}</div>;
}
