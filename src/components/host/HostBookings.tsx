"use client";

import { useMemo, useState } from "react";
import type { HostBooking } from "@/lib/host";

const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function HostBookings({ initial }: { initial: HostBooking[] }) {
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [adjustment, setAdjustment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => items.filter(item => {
    const needle = query.toLowerCase();
    return (!status || item.status === status) && (!needle || [String(item.id), item.customer, item.tour_title, item.check_in, item.phone].some(value => value.toLowerCase().includes(needle)));
  }), [items, query, status]);
  const guests = filtered.reduce((sum, item) => sum + item.guests, 0);
  const total = filtered.reduce((sum, item) => sum + item.total, 0);
  const balance = filtered.reduce((sum, item) => sum + item.balance, 0);

  async function saveAdjustment(orderId: number) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/host/bookings/adjustment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: orderId, amount: Number(adjustment) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Adjustment failed.");
      const refresh = await fetch("/api/host/bookings", { cache: "no-store" });
      const listing = refresh.ok ? await refresh.json() as { items?: HostBooking[] } : null;
      setItems(listing?.items || items.map(item => item.id === orderId ? { ...item, adjustment: data.amount } : item));
      setEditing(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <><div className="host-toolbar"><div><span className="host-eyebrow">HOST CUSTOMER DESK</span><h1 className="host-title">Your bookings.<br /><em>Your crew.</em></h1><p className="host-copy">Search travellers, track payments and keep every departure organised.</p></div></div>
    <section className="host-grid four"><div className="host-card host-metric"><small>Bookings</small><strong>{filtered.length}</strong></div><div className="host-card host-metric"><small>Guests</small><strong>{guests}</strong></div><div className="host-card host-metric"><small>Booking total</small><strong>{money(total)}</strong></div><div className="host-card host-metric"><small>Balance</small><strong>{money(balance)}</strong></div></section>
    <section className="host-section"><div className="host-panel" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><input className="host-search" style={{ flex: "2 1 240px" }} placeholder="Booking ID, traveller, trip or departure" aria-label="Search bookings" value={query} onChange={event => setQuery(event.target.value)} /><select className="host-search" style={{ flex: "1 1 180px" }} aria-label="Booking status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{Array.from(new Set(items.map(item => item.status))).map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></div></section>
    {error && <p className="host-error" role="alert">{error}</p>}
    {filtered.length ? <div className="host-table-wrap"><table className="host-table"><thead><tr><th>Booking</th><th>Departure</th><th>Trip</th><th>Customer</th><th>Phone</th><th>People</th><th>Total</th><th>Advance due</th><th>Balance</th><th>Adjustment</th><th>Status</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td>#{item.id}<span>{item.created_at?.slice(0, 10)}</span></td><td>{item.check_in || "TBA"}</td><td><strong>{item.tour_title}</strong></td><td>{item.customer}<span>{item.email}</span></td><td>{item.phone}</td><td>{item.guests}</td><td>{money(item.total)}</td><td>{money(item.advance)}</td><td>{money(item.balance)}</td><td>{editing === item.id ? <div className="host-form" style={{ minWidth: 120 }}><input type="number" step="0.01" max="0" value={adjustment} onChange={event => setAdjustment(event.target.value)} /><button type="button" className="host-text-link" disabled={busy} onClick={() => saveAdjustment(item.id)}>Save</button></div> : <button type="button" className="host-text-link" style={{ border: 0, background: "none", cursor: "pointer" }} disabled={["complete", "completed", "fully_paid", "cancelled", "canceled", "refunded"].includes(item.status)} onClick={() => { setEditing(item.id); setAdjustment(String(item.adjustment)); }}>{money(item.adjustment)} ✎</button>}</td><td><span className="host-status">{item.status.replaceAll("_", " ")}</span><span>{item.payment_status.replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div> : <div className="host-empty"><h3>No bookings found.</h3><p>Try a different search or wait for your first crew to book.</p></div>}
  </>;
}
