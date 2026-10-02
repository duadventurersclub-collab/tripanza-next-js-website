"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HostBooking } from "@/lib/host";
import "./bookings-original.css";

const headers = ["S.no.", "#ID", "Departure", "Trip", "Customer", "Phone", "Person", "Add-ons", "Total", "Advance", "Balance", "Adjustment", "Status"];

const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function HostBookings({ initial }: { initial: HostBooking[] }) {
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [tripQuery, setTripQuery] = useState("");
  const [dateNotes, setDateNotes] = useState("");
  const [visible, setVisible] = useState(headers.map(() => true));
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [adjustment, setAdjustment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => items.filter(item => {
    const needle = query.toLowerCase();
    return (!status || item.status === status) && (!tripQuery || item.tour_title.toLowerCase().includes(tripQuery.toLowerCase())) && (!needle || [String(item.id), item.customer, item.tour_title, item.check_in, item.phone].some(value => value.toLowerCase().includes(needle)));
  }), [items, query, tripQuery, status]);
  const guests = filtered.reduce((sum, item) => sum + item.guests, 0);
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

  return <div className="thb-page"><header className="thb-topbar"><Link href="/host" className="thb-brand"><i>T</i><span>Tripanza</span></Link></header>
    <section className="thb-hero"><div><span className="thb-eyebrow">HOST CUSTOMER DESK</span><h1>Your bookings.<br /><em>Your crew.</em></h1><p>Search travellers, track payments and keep every departure organised from one place.</p></div><div className="thb-hero-mark">♙</div></section>
    <section className="thb-stats" aria-label="Filtered booking summary"><article><small>Bookings</small><strong>{filtered.length}</strong></article><article><small>Guests</small><strong>{guests}</strong></article><article><small>Collected</small><strong>{money(filtered.reduce((sum, item) => sum + item.advance, 0))}</strong></article><article><small>Balance</small><strong>{money(balance)}</strong></article></section>
    <div className="booking-dashboard-wrapper"><div className="controls-grid"><form onSubmit={event => event.preventDefault()}><input type="text" placeholder="Booking ID or Departure Date" value={query} onChange={event => setQuery(event.target.value)} /><button type="submit">Search</button></form><form onSubmit={event => event.preventDefault()}><input type="text" placeholder="Trip Name" value={tripQuery} onChange={event => setTripQuery(event.target.value)} /><button type="submit">Search</button></form><form onSubmit={event => event.preventDefault()}><select value={status} onChange={event => setStatus(event.target.value)}><option value="">All Statuses</option>{Array.from(new Set(items.map(item => item.status))).map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><button type="submit">Search</button></form></div>
      <div style={{ marginBottom: 20 }}><textarea placeholder="Check-in Check-out dates" rows={3} value={dateNotes} onChange={event => setDateNotes(event.target.value)} /></div>
      <div className="master-actions"><button type="button" onClick={() => { const columns = ["ID","Departure","Trip","Customer","Email","Phone","Person","Total","Advance","Balance","Adjustment","Status"]; const lines = filtered.map(item => [item.id,item.check_in,item.tour_title,item.customer,item.email,item.phone,item.guests,item.total,item.advance,item.balance,item.adjustment,item.status].map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")); const blob = new Blob([[columns.join(","),...lines].join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "host-bookings.csv"; link.click(); URL.revokeObjectURL(url); }}>Export to CSV</button><button type="button" onClick={() => window.print()}>Export to PDF</button></div>
      <details className="thb-column-settings"><summary>☷ Choose table columns</summary><div className="toggle-buttons">{headers.map((header, index) => <button type="button" key={header} className={visible[index] ? "active" : ""} onClick={() => setVisible(current => current.map((item, at) => at === index ? !item : item))}>{header}</button>)}<button type="button" className="btn-modern" onClick={() => setVisible(headers.map(() => true))}>Show all</button><button type="button" className="btn-modern" onClick={() => setVisible(headers.map(() => false))}>Hide all</button></div></details>
      {error && <p role="alert" className="thb-error">{error}</p>}
      <div className="table-responsive-wrapper"><table className="table table-bordered table-striped table-booking-history"><thead><tr>{headers.map((header, index) => visible[index] && <th key={header}>{header}</th>)}</tr></thead><tbody className="booking-history-title">{filtered.map((item, index) => <tr className="order-row" key={item.id}>
        {visible[0] && <td>{index + 1}</td>}{visible[1] && <td>{item.id}</td>}{visible[2] && <td>{item.check_in || "TBA"}</td>}{visible[3] && <td><a href={`/tours/${item.tour_slug || item.tour_id}`}>{item.tour_title}</a></td>}{visible[4] && <td><strong className="thb-customer-name">{item.customer}</strong><a className="thb-customer-email" href={`mailto:${item.email}`}>{item.email}</a></td>}{visible[5] && <td><span className="thb-phone-number">{item.phone}</span><span className="thb-contact-actions"><a href={`tel:${item.phone}`} aria-label="Call customer">☎</a><a href={`https://wa.me/${item.phone.replace(/\\D/g, "")}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp customer">◉</a></span></td>}{visible[6] && <td>Total: {item.guests}</td>}{visible[7] && <td>—</td>}{visible[8] && <td>{money(item.total)}</td>}{visible[9] && <td>{money(item.advance)}</td>}{visible[10] && <td>{money(item.balance)}</td>}{visible[11] && <td>{editing === item.id ? <div><input type="number" step="0.01" max="0" value={adjustment} onChange={event => setAdjustment(event.target.value)} /><button type="button" disabled={busy} onClick={() => saveAdjustment(item.id)}>Save</button></div> : <button type="button" disabled={["complete","completed","fully_paid","cancelled","canceled","refunded"].includes(item.status)} onClick={() => { setEditing(item.id); setAdjustment(String(item.adjustment)); }}>{money(item.adjustment)} ✎</button>}</td>}{visible[12] && <td>{item.status.replaceAll("_", " ")}<br />{item.payment_status.replaceAll("_", " ")}</td>}
      </tr>)}{!filtered.length && <tr><td colSpan={visible.filter(Boolean).length || 1}>No bookings found.</td></tr>}</tbody></table></div>
    </div>
  </div>;
}
