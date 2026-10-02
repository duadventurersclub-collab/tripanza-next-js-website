"use client";

import { useState, type FormEvent } from "react";
import type { HostProfile } from "@/lib/host";
import "./custom-trip-builder.css";

type Day = { title: string; description: string };
type Departure = { date: string; quad: number; triple: number; twin: number };
type Faq = { question: string; answer: string };
type Extra = { name: string; price: number; required: boolean };

const today = () => { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 10); };

export default function HostCustomTripBuilder({ profile }: { profile: HostProfile }) {
  const [days, setDays] = useState<Day[]>([{ title: "Day 1", description: "" }]);
  const [departures, setDepartures] = useState<Departure[]>([{ date: "", quad: 0, triple: 0, twin: 0 }]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ message: string; status: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setResult(null);
    const form = new FormData(event.currentTarget);
    form.set("itinerary", JSON.stringify(days));
    form.set("departures", JSON.stringify(departures));
    form.set("faqs", JSON.stringify(faqs));
    form.set("extras", JSON.stringify(extras));
    try {
      const response = await fetch("/api/host/custom-trips", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "The trip could not be saved.");
      setResult({ message: data.message || "Trip saved.", status: data.status || "draft" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <div className="hct-page"><main className="hct-shell">
    <header className="hct-hero"><span>HOST DASHBOARD / CREATE A TRIP</span><h1>Your route.<br /><em>Your rules.</em></h1><p>Build an original itinerary, add live departures and send it to Tripanza for review without leaving Host mode.</p></header>
    {result && <div className="hct-success" role="status"><b>{result.status === "draft" ? "Draft saved" : "Sent for review"}</b><span>{result.message}</span></div>}
    {error && <div className="hct-error" role="alert"><b>Couldn’t save the trip.</b><span>{error}</span></div>}
    <form onSubmit={submit} className="hct-form">
      <nav className="hct-map" aria-label="Trip builder sections"><span><b>01</b> Story</span><span><b>02</b> Booking</span><span><b>03</b> Launch</span></nav>

      <section className="hct-section"><header><span>01</span><div><h2>Trip story</h2><p>The essentials travellers see first.</p></div></header><div className="hct-fields">
        <label className="wide">Tour title *<input name="title" required minLength={4} placeholder="Spiti Valley road trip" /></label>
        <label className="wide">Trip overview<textarea name="description" rows={5} placeholder="What makes this trip worth joining?" /></label>
        <label>Trip from *<input name="origin" required placeholder="Delhi" /></label><label>Destination *<input name="destination" required placeholder="Spiti Valley" /></label>
        <label>Trip ends at<input name="dropoff" placeholder="Delhi" /></label><label>Duration *<input name="duration" required placeholder="6N/7D" /></label>
        <label className="wide">Short highlights<textarea name="highlights" rows={3} placeholder="One highlight per line" /></label>
        <label>What is included<textarea name="included" rows={4} placeholder="Stays&#10;Transport&#10;Meals" /></label><label>What is excluded<textarea name="excluded" rows={4} placeholder="Flights&#10;Personal expenses" /></label>
      </div></section>

      <section className="hct-section"><header><span>02</span><div><h2>Cover and gallery</h2><p>Missing media is safely saved as a draft.</p></div></header><div className="hct-fields">
        <label>Featured cover image<input name="featured" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></label>
        <label>PDF cover image <small>Optional; featured cover is used by default</small><input name="pdf_cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></label>
        <label className="wide">Tour gallery <small>Up to 12 images, 8 MB each</small><input name="gallery[]" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple /></label>
      </div></section>

      <section className="hct-section"><header><span>03</span><div><h2>Day-wise itinerary</h2><p>Give every day a clear purpose.</p></div></header><div className="hct-repeat">{days.map((day, index) => <article key={index}><div className="hct-row-head"><b>Day {index + 1}</b>{days.length > 1 && <button type="button" onClick={() => setDays(current => current.filter((_, item) => item !== index))}>Remove</button>}</div><label>Title<input value={day.title} onChange={event => setDays(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} placeholder={`Day ${index + 1}`} /></label><label>Description<textarea rows={3} value={day.description} onChange={event => setDays(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} /></label></article>)}</div><button className="hct-add" type="button" onClick={() => setDays(current => [...current, { title: `Day ${current.length + 1}`, description: "" }])}>+ Add another day</button></section>

      <section className="hct-section"><header><span>04</span><div><h2>Departures and pricing</h2><p>Tripanza’s launch platform fee is ₹500 per confirmed traveller.</p></div></header><div className="hct-repeat">{departures.map((departure, index) => <article key={index}><div className="hct-row-head"><b>Departure {index + 1}</b>{departures.length > 1 && <button type="button" onClick={() => setDepartures(current => current.filter((_, item) => item !== index))}>Remove</button>}</div><div className="hct-fields four"><label>Date *<input type="date" min={today()} required value={departure.date} onChange={event => setDepartures(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, date: event.target.value } : item))} /></label><label>Quad sharing ₹<input type="number" min="0" value={departure.quad || ""} onChange={event => setDepartures(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, quad: Number(event.target.value) } : item))} /></label><label>Triple sharing ₹<input type="number" min="0" value={departure.triple || ""} onChange={event => setDepartures(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, triple: Number(event.target.value) } : item))} /></label><label>Twin sharing ₹<input type="number" min="0" value={departure.twin || ""} onChange={event => setDepartures(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, twin: Number(event.target.value) } : item))} /></label></div></article>)}</div><button className="hct-add" type="button" onClick={() => setDepartures(current => [...current, { date: "", quad: current[0]?.quad || 0, triple: current[0]?.triple || 0, twin: current[0]?.twin || 0 }])}>+ Add operating date</button></section>

      <section className="hct-section"><header><span>05</span><div><h2>Booking rules</h2><p>Capacity, deposits and selling-host reward.</p></div></header><div className="hct-fields four"><label>Maximum people<input name="capacity" type="number" min="1" max="200" defaultValue="20" /></label><label>Minimum people<input name="minimum" type="number" min="1" defaultValue="1" /></label><label>Advance deposit %<input name="deposit" type="number" min="1" max="100" defaultValue="25" /></label><label>Book at least days before<input name="booking_period" type="number" min="0" defaultValue="1" /></label><label>Balance due days before<input name="balance_days" type="number" min="0" defaultValue="7" /></label><label>Host commission / person ₹<input name="commission" type="number" min="0" defaultValue="0" /></label></div></section>

      <section className="hct-section"><header><span>06</span><div><h2>FAQs and upgrades</h2><p>Optional details that reduce booking questions.</p></div></header><div className="hct-two"><div><h3>Frequently asked questions</h3>{faqs.map((faq, index) => <article className="hct-mini" key={index}><button type="button" onClick={() => setFaqs(current => current.filter((_, item) => item !== index))}>×</button><input value={faq.question} onChange={event => setFaqs(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item))} placeholder="Question" /><textarea value={faq.answer} onChange={event => setFaqs(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, answer: event.target.value } : item))} placeholder="Answer" /></article>)}<button className="hct-add" type="button" onClick={() => setFaqs(current => [...current, { question: "", answer: "" }])}>+ Add FAQ</button></div><div><h3>Paid upgrades</h3>{extras.map((extra, index) => <article className="hct-mini" key={index}><button type="button" onClick={() => setExtras(current => current.filter((_, item) => item !== index))}>×</button><input value={extra.name} onChange={event => setExtras(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="Upgrade name" /><input type="number" min="0" value={extra.price || ""} onChange={event => setExtras(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, price: Number(event.target.value) } : item))} placeholder="Price ₹" /><label className="hct-check"><input type="checkbox" checked={extra.required} onChange={event => setExtras(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked } : item))} /> Required for every traveller</label></article>)}<button className="hct-add" type="button" onClick={() => setExtras(current => [...current, { name: "", price: 0, required: false }])}>+ Add upgrade</button></div></div></section>

      <section className="hct-section"><header><span>07</span><div><h2>Host contact</h2><p>Used by Tripanza while reviewing the trip.</p></div></header><div className="hct-fields"><label>Phone<input name="phone" defaultValue={profile.phone || ""} /></label><label>Email<input name="contact_email" type="email" /></label><label className="wide">Website or Instagram<input name="website" type="url" defaultValue={profile.instagram || ""} placeholder="https://" /></label></div></section>

      <button className="hct-submit" type="submit" disabled={busy}><span>{busy ? "Saving your trip…" : "Save and send for review"}</span><b>→</b></button>
    </form>
  </main></div>;
}
