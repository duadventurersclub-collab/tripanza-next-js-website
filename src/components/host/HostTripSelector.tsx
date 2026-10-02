"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HostTour } from "@/lib/host";
import "./trips-original.css";

const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

export default function HostTripSelector({ items }: { items: HostTour[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [markup, setMarkup] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<HostTour | null>(null);
  const [people, setPeople] = useState<Record<number, number>>({});
  const [openTrips, setOpenTrips] = useState<Record<number, boolean>>({});
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});

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

  return <div className="ty-page"><header className="ty-topbar"><Link className="ty-logo" href="/host">Tripanza</Link></header><div className="trip-host-wrapper">
    <div className="ty-host-head"><span>HOST DASHBOARD / BUILD A CREW</span><h1>Pick the trip.<br /><em>Make it yours.</em></h1><p>Choose one live Tripanza itinerary, select the departures you want to host and launch your crew page.</p></div>
    {created && <div className="success-notice" role="status">Your hosted trip is live. <Link href={`/tours/${created.slug}`}>View the trip →</Link></div>}
    {error && <div className="ty-form-error" role="alert"><b>!</b><span>{error}</span></div>}
    {!items.length ? <div className="ty-empty"><b>TRIPS LOADING SOON</b><h2>The next host drop is being built.</h2><p>There are no master trips available right now. Check back soon or contact the Tripanza team.</p><Link href="/contact">Talk to host support →</Link></div> : <form onSubmit={submit} id="host-trip-form">
      {items.map(trip => <div className="host-trip-card" key={trip.id}>
        <label className="main-checkbox-label"><input type="radio" name="trip" checked={selected === trip.id} onChange={() => pick(trip.id)} required />{trip.image && <img src={trip.image} alt={trip.title} />}<div className="trip-title">{trip.title}</div></label>
        {!!trip.commission_per_person && <div className="tripanza-earnings-box"><div className="tripanza-earnings-input"><label>Expected Travelers</label><input type="number" min="1" value={people[trip.id] ?? 10} onChange={event => setPeople(current => ({ ...current, [trip.id]: Number(event.target.value) }))} className="tripanza-people" /></div><div className="tripanza-earnings-result">Estimated Earnings <span className="tripanza-earnings">{money((people[trip.id] ?? 10) * (trip.commission_per_person || 0))}</span></div></div>}
        <div className="trip-dates-card"><div className="trip-dates-header"><span>Select Dates</span><button type="button" className="dates-toggle" onClick={() => setOpenTrips(current => ({ ...current, [trip.id]: !(current[trip.id] ?? true) }))}>{(openTrips[trip.id] ?? true) ? "▼" : "▶"}</button></div>
          {(openTrips[trip.id] ?? true) && <div className="trip-dates-body">{trip.departures?.length ? <><label className="select-all-wrapper"><input type="checkbox" checked={selected === trip.id && trip.departures.every(departure => dates.includes(departure.date))} onChange={event => { pick(trip.id); if (event.target.checked) setDates(trip.departures!.map(departure => departure.date)); }} /><span className="trip-date">Select All Available Dates</span></label>
            {trip.departures.map(departure => { const extra = markup[departure.date] || 0; const opened = openDates[departure.date] ?? true; return <div className="trip-date-card" key={departure.date}><div className="trip-date-header"><label className="trip-date-left"><input type="checkbox" checked={selected === trip.id && dates.includes(departure.date)} onChange={() => { if (selected !== trip.id) { pick(trip.id); setDates([departure.date]); } else toggle(departure.date); }} /><span className="trip-date">{new Date(`${departure.date}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></label><button type="button" className="trip-toggle" onClick={() => setOpenDates(current => ({ ...current, [departure.date]: !opened }))}>{opened ? "▼" : "▶"}</button></div>
              {opened && <div className="trip-price-panel"><div className="trip-price-slider"><div className="base-prices"><div>Base Quad: {money(departure.adult_price)}</div><div>Base Triple: {money(departure.child_price)}</div><div>Base Twin: {money(departure.infant_price)}</div></div><div className="markup-slider"><label>Markup per person</label><input type="range" min="0" max="5000" step="100" value={extra} onChange={event => setMarkup(current => ({ ...current, [departure.date]: Number(event.target.value) }))} /><span className="markup-value">{money(extra)}</span></div><div className="new-prices"><div>Final Quad: {money(departure.adult_price + extra)}</div><div>Final Triple: {money(departure.child_price + extra)}</div><div>Final Twin: {money(departure.infant_price + extra)}</div></div></div></div>}</div>; })}</> : <p>No upcoming dates available for this trip.</p>}</div>}</div>
      </div>)}
      <button type="submit" className="host-submit-btn" disabled={busy || !selected}>{busy ? "Launching trip…" : "Host Selected Trip"}</button>
    </form>}</div></div>;
}
