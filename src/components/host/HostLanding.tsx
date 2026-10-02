"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HostSummary, HostTour } from "@/lib/host";
import "./landing-original.css";

async function post(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`/api/host/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || "Please try again.");
  return data;
}

type Leader = { id: number; name: string; slug: string; revenue: number; earnings: number; bookings: number };

export default function HostLanding({ trips, hosts, leaderboard, signedIn, accountEmail, isHost, openInitially }: { trips: HostTour[]; hosts: HostSummary[]; leaderboard: Leader[]; signedIn: boolean; accountEmail: string; isHost: boolean; openInitially: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(openInitially && signedIn && !isHost);
  const [people, setPeople] = useState(10);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(accountEmail);
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [gst, setGst] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const existingEmail = accountEmail !== "";
  const onboardingSteps = existingEmail ? [0, 3, 4] : [0, 1, 2, 3, 4];
  const progressIndex = onboardingSteps.indexOf(step);

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
        setStep(existingEmail ? 3 : 1);
      } else if (step === 1) {
        await post("registration/send-code", { email }); setStep(2);
      } else if (step === 2) {
        const data = await post("registration/verify-code", { email, code }); setTicket(data.ticket); setStep(3);
      } else if (step === 3) {
        if (phone.replace(/\D/g, "").length < 10) throw new Error("Enter a valid traveller contact number.");
        setStep(4);
      } else {
        if (!terms) throw new Error("Accept the Tripanza Host Policies to continue.");
        await post("registration", { name, email: existingEmail ? accountEmail : email, phone, instagram, gst, ticket, accept_terms: true });
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

  return <div className="th-host-root"><main className="th-page"><header className="th-top th-shell"><button type="button" className="th-back" aria-label="Go back" onClick={() => window.history.length > 1 ? window.history.back() : router.push("/")}><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg></button><Link className="th-logo" href="/"><i>T</i>Tripanza</Link></header>
  <section className="th-hero th-shell"><div className="th-hero-copy"><span className="th-kicker"><i /> BUILD THE CREW</span><h1>Your people.<br />Your trip.<br /><em>Your upside.</em></h1><p>Bring the community. Tripanza brings the itinerary, operations and booking tech. You host the energy—and earn when your people book.</p><div className="th-hero-actions"><button className="th-button" type="button" onClick={start}>{isHost ? "Open host dashboard" : "Claim host mode"}<i>→</i></button><a className="th-text-link" href="#how">See how it works ↓</a></div></div><div className="th-hero-visual"><span className="th-float th-float-one"><i /> BOOKING LANDED</span><span className="th-float th-float-two">12 / 16 CREW IN</span><div className="th-host-pass"><div className="th-pass-top"><span>TRIPANZA HOST PASS</span><b>001</b></div><div className="th-pass-route"><small>GROUP CHAT</small><i>→</i><small>GROUP TRIP</small></div><h2>Make the plan<br /><em>actually happen.</em></h2><div className="th-pass-crew"><div><span>A</span><span>R</span><span>S</span><span>+9</span></div><p><strong>Your crew is moving.</strong><small>3 new bookings this week</small></p></div><div className="th-pass-money"><span><small>EST. HOST UPSIDE</small><strong>₹24,000</strong></span><i>LIVE</i></div></div><div className="th-hero-note"><strong>No logistics degree required.</strong><span>Pick the trip. Rally your people. We handle the ground game.</span></div></div></section>
  <div className="th-proof th-shell"><div><strong>{hosts.length}+</strong><span>COMMUNITY HOSTS</span></div><div><strong>{trips.length}</strong><span>FEATURED TRIPS</span></div><div><strong>₹0</strong><span>SETUP FEE</span></div></div>
  <section className="th-section th-shell" id="how"><div className="th-section-head"><div><span className="th-kicker">HOSTING, DECOMPLICATED</span><h2>Four moves.<br /><em>One live crew.</em></h2></div><p>You focus on the community. Tripanza keeps the booking and operational machinery moving.</p></div><div className="th-steps">{[["Claim host mode","Create your profile, add your identity and unlock the host dashboard."],["Pick the trip","Choose a ready itinerary and departure that matches your people."],["Drop the link","Share your branded trip page, reels and itinerary with the community."],["Host and earn","Watch bookings land, host the vibe and receive your eligible payout."]].map(([title,copy],index) => <article className="th-step" key={title}><span className="th-step-number">0{index+1}</span><h3>{title}</h3><p>{copy}</p><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="25" /></svg></article>)}</div></section>
  <section className="th-section th-shell"><div className="th-earn"><div><span className="th-kicker">PLAY WITH THE NUMBERS</span><h2>A full crew can<br /><em>hit different.</em></h2><p>Move the slider for a simple illustration based on ₹2,000 estimated host earnings per confirmed traveller. Your actual margin depends on the selected trip.</p></div><div className="th-calculator"><small>ESTIMATED HOST EARNINGS</small><output htmlFor="thPeople">₹{(people*2000).toLocaleString("en-IN")}</output><input type="range" id="thPeople" min="1" max="50" value={people} onChange={event => setPeople(Number(event.target.value))} /><label><span>{people} travellers</span><span>Up to 50</span></label><p>Illustrative estimate only. Final earnings and payout eligibility appear in your host dashboard.</p></div></div></section>
  <section className="th-section th-shell" id="host-league"><div className="th-league"><div className="th-league-head"><div><span className="th-league-live">LIVE HOST LEAGUE · THIS MONTH</span><h2>Build crews.<br /><em>Climb the board.</em></h2></div><p>Real hosts ranked by confirmed booking revenue. Start your host era and put your name in the race.</p></div>{leaderboard.length ? <div className="th-league-board"><div className="th-league-labels"><span>#</span><span>HOST</span><span>REVENUE</span><span>EARNED</span></div>{leaderboard.map((host,index) => <Link className="th-league-row" href={`/host/${host.slug}`} key={host.id}><span className="th-rank">{String(index+1).padStart(2,"0")}</span><span className="th-league-host"><span className="th-league-avatar">{host.name[0]}</span><span><b>{host.name}</b><small>{host.bookings} confirmed bookings</small></span></span><span className="th-league-number"><small>TRIP VALUE</small><strong>₹{Math.round(host.revenue).toLocaleString("en-IN")}</strong></span><span className="th-league-number"><small>HOST EARNINGS</small><strong>₹{Math.round(host.earnings).toLocaleString("en-IN")}</strong></span></Link>)}</div> : <div className="th-league-empty"><strong>The first crown is still unclaimed.</strong><span>Make the first confirmed booking this month and set the score.</span></div>}<div className="th-league-foot"><p>Updated every 10 minutes · Confirmed bookings only · Rankings reset monthly</p><button className="th-button" type="button" onClick={start}>{isHost ? "View my dashboard" : "Put me on the board"}<i>→</i></button></div></div></section>
  {!!trips.length && <section className="th-section th-shell"><div className="th-section-head"><div><span className="th-kicker">READY FOR YOUR PEOPLE</span><h2>Pick the trip.<br /><em>Add your energy.</em></h2></div><p>These live Tripanza itineraries can become your next community departure.</p></div><div className="th-scroll">{trips.slice(0,6).map(trip => <Link className="th-trip" href={`/tours/${trip.slug}`} key={trip.id}><div className="th-trip-media">{trip.image && <img src={trip.image} alt={trip.title} />}<span>CREW READY</span></div><div className="th-trip-body"><h3>{trip.title}</h3><div className="th-trip-meta"><span>{trip.duration || "Live trip"} days</span><span>{trip.address || "India"}</span></div><div className="th-trip-price"><div><small>{trip.price ? "Starts from" : "Pricing"}</small><strong>{trip.price ? `₹${trip.price.toLocaleString("en-IN")}` : "Check dates"}</strong></div><i>→</i></div></div></Link>)}</div></section>}
  {!!hosts.length && <section className="th-section th-shell"><div className="th-section-head"><div><span className="th-kicker">ALREADY BUILDING CREWS</span><h2>Meet the<br /><em>host circle.</em></h2></div><p>Creators, organisers and community humans turning followers into real memories.</p></div><div className="th-scroll">{hosts.slice(0,8).map(host => <Link className="th-host" href={`/host/${host.slug}`} key={host.id}><div className="th-host-cover" /><span className="th-host-avatar">{host.logo ? <img src={host.logo} alt="" /> : host.name[0]}</span><b>{host.name}</b><small>{host.trip_count} live trips</small>{host.verified && <small className="th-verified">✓ VERIFIED HOST</small>}</Link>)}</div></section>}
  <section className="th-section th-shell"><div className="th-section-head"><div><span className="th-kicker">NO CORPORATE CONFUSION</span><h2>Questions,<br /><em>answered straight.</em></h2></div></div><div className="th-faq">{[["Who can host on Tripanza?","College organisers, creators, community leaders, travel clubs and anyone who can bring a genuine group together can apply."],["Does becoming a host cost anything?","No. Host registration has no setup fee."],["Do I manage hotels, transport and operations?","No. Tripanza and the relevant ground partners manage published itinerary operations."],["How are host earnings calculated?","Earnings depend on the selected trip, approved margin and confirmed attributed bookings."],["When is the payout released?","Payout timing depends on successful trip completion and reconciliation."]].map(([q,answer]) => <details key={q}><summary>{q}</summary><p>{answer}</p></details>)}</div></section>
  <section className="th-final th-shell"><div><h2>Your group chat<br />needs a departure.</h2><p>Claim host mode, choose the trip and start building the crew.</p></div><button className="th-button" type="button" onClick={start}>{isHost ? "Open dashboard" : "Become a host"}<i>→</i></button></section></main><div className="th-sticky"><button className="th-button" type="button" onClick={start}><span>{isHost ? "Open dashboard" : "Become a host"}</span><i>→</i></button></div>{open && <div className="th-register-modal is-open" role="dialog" aria-modal="true" aria-labelledby="thRegisterTitle"><div className="th-register-sheet"><header className="th-register-bar"><div><i /><span id="thRegisterTitle">BECOME A TRIPANZA HOST</span></div><button type="button" onClick={() => setOpen(false)} aria-label="Close host registration">×</button></header><div className="th-host-form"><div className="th-form-progress"><div><span>HOST ONBOARDING</span><strong>Step {progressIndex + 1} of {onboardingSteps.length}</strong></div><p aria-label="Registration progress">{onboardingSteps.map((_, index) => <i key={index} style={{ opacity: index <= progressIndex ? 1 : .25 }} />)}</p></div><div className="th-form-heading"><span>{step === 4 ? "PUBLIC HOST PROFILE READY" : "YOUR PUBLIC PROFILE"}</span><h2>{["How should travellers recognise you?","Where can we send your code?","Verify your email.","How can travellers reach you?","Look familiar. Build trust. Host the crew."][step]}</h2><p>Your public details help travellers know who they’re joining.</p></div><div className="th-form-body">
    {step === 0 && <section><label>Public host name <small>VISIBLE TO TRAVELLERS</small><input value={name} onChange={event => setName(event.target.value)} placeholder="Your name or community name" minLength={2} required /></label><label>Profile photo <small>VISIBLE TO TRAVELLERS</small><span className="th-upload"><b>{logo ? "✓" : "+"}</b><span><strong>{logo?.name || "Add a recognisable photo or logo"}</strong><em>Help travellers know exactly who is hosting.</em></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setLogo(event.target.files?.[0] || null)} /></span></label></section>}
    {step === 1 && <section><label>Login email <small className="private">PRIVATE</small><span className="th-email-row"><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /><button type="button" onClick={() => void submit()} disabled={busy}>Send code</button></span></label></section>}
    {step === 2 && <section><label>6-digit email code <span className="th-email-row"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g,""))} placeholder="••••••" /><button type="button" onClick={() => void submit()} disabled={busy}>Verify</button></span></label><button type="button" onClick={async () => { try { await post("registration/send-code", { email }); setError(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Try again."); } }}>Resend code</button></section>}
    {step === 3 && <section><label>Traveller contact number <small>VISIBLE TO TRAVELLERS</small><input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+91 98765 43210" required /></label><div className="th-form-note"><b>☎</b><p><strong>Use a number travellers can reach.</strong>This may appear on your host profile and hosted trips.</p></div><label>Instagram or website <small>PUBLIC · OPTIONAL</small><input value={instagram} onChange={event => setInstagram(event.target.value)} placeholder="https://instagram.com/yourhandle" /></label><label>GST number <small className="private">PRIVATE · OPTIONAL</small><input value={gst} onChange={event => setGst(event.target.value)} placeholder="Add it now or later" /></label></section>}
    {step === 4 && <section><div className="th-ready"><span>PUBLIC HOST PROFILE READY</span><h3>Look familiar.<br />Build trust.<br /><em>Host the crew.</em></h3><p>Your public details help travellers know who they’re joining.</p></div><label className="th-terms"><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} /><span>I agree to the <Link href="/tnc" target="_blank">Tripanza Host Policies</Link></span></label></section>}
    </div>{error && <div className="th-form-error" role="alert">{error}</div>}<div className="th-form-actions">{step > 0 && <button type="button" onClick={() => setStep(onboardingSteps[Math.max(0, progressIndex - 1)])}>Back</button>}<button type="button" className="primary" onClick={() => void submit()} disabled={busy}>{busy ? "Please wait…" : step === 4 ? "Unlock host mode" : step === 1 ? "Send code" : step === 2 ? "Verify code" : "Next"} <i>→</i></button></div></div></div></div>}</div>;
}
