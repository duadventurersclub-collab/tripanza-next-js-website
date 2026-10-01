"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HostTour } from "@/lib/host";

const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

export default function HostTripSelector({ items }: { items: HostTour[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [markup, setMarkup] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<HostTour | null>(null);

  function pick(id: number) { setSelected(id); setDates([]); setMarkup({}); setError(""); }
  function toggle(date: string) { setDates(current => current.includes(date) ? current.filter(item => item !== date) : [...current, date]); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !dates.length) { setError("Choose one trip and at least one departure."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/host/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tour_id: selected, dates, markup }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Could not create your trip.");
      setCreated(data.trip);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <><div className="host-toolbar"><div><span className="host-eyebrow">HOST DASHBOARD / BUILD A CREW</span><h1 className="host-title">Pick the trip.<br /><em>Make it yours.</em></h1><p className="host-copy">Choose one live Tripanza itinerary, select departures, and launch your crew page.</p></div></div>
    {created && <div className="host-success" role="status">Your hosted trip is live. <Link href={`/tours/${created.slug}`}>View the trip →</Link></div>}
    {error && <div className="host-error" role="alert">{error}</div>}
    {!items.length ? <div className="host-empty"><h3>The next host drop is being built.</h3><p>There are no master trips available right now.</p><Link className="host-button" href="/contact">Talk to host support <span>→</span></Link></div> : <form onSubmit={submit} className="host-form"><div className="host-grid">{items.map(trip => <article key={trip.id} className="host-card" style={{ borderColor: selected === trip.id ? "#3157d5" : undefined }}><label style={{ display: "block", cursor: "pointer" }}><input type="radio" name="trip" checked={selected === trip.id} onChange={() => pick(trip.id)} style={{ position: "absolute", opacity: 0 }} />{trip.image && <img src={trip.image} alt="" />}<div className="host-card-body"><span className="host-eyebrow">{selected === trip.id ? "SELECTED TRIP" : "CREW READY"}</span><h3>{trip.title}</h3><p>{trip.duration} days · {trip.address || "India"}</p><p>Host commission: <strong>{money(trip.commission_per_person || 0)} / traveller</strong></p><p>{trip.departures?.length || 0} bookable departures</p></div></label>{selected === trip.id && <div className="host-card-body" style={{ borderTop: "1px solid #dce3ee" }}><strong>Choose your departures</strong>{trip.departures?.map(departure => <div key={departure.date} style={{ padding: "10px 0", borderBottom: "1px solid #eef1f5" }}><label style={{ display: "flex", alignItems: "center", gap: 9 }}><input type="checkbox" checked={dates.includes(departure.date)} onChange={() => toggle(departure.date)} style={{ width: 18, minHeight: 18 }} /><span>{new Date(`${departure.date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></label><p style={{ margin: "7px 0", fontSize: 11, color: "#707a8d" }}>Base quad {money(departure.adult_price)} · Triple {money(departure.child_price)} · Twin {money(departure.infant_price)}</p>{dates.includes(departure.date) && <label>Extra host markup per person (₹0–₹5,000)<input type="number" min="0" max="5000" step="1" value={markup[departure.date] || 0} onChange={event => setMarkup(current => ({ ...current, [departure.date]: Number(event.target.value) }))} /></label>}</div>)}</div>}</article>)}</div><button type="submit" className="host-button blue" disabled={busy || !selected}>{busy ? "Launching trip…" : "Host selected trip"}<span>→</span></button></form>}
  </>;
}
