"use client";
import Link from "next/link";
import { nativeBookingEditUrl } from "@/lib/admin-booking-editor-types";
import { useEffect, useRef } from "react";
import { money, type AdminBooking } from "@/lib/admin-bookings-types";
export default function AdminBookingDetails({ row, close }: { row: AdminBooking; close: () => void }) {
  const panel = useRef<HTMLDivElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; closeButton.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const nodes = panel.current?.querySelectorAll<HTMLElement>('a[href],button'); if (!nodes?.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
      if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
    }
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, [close]);
  return <><div className="side-modal-overlay active" onClick={close} /><div ref={panel} className="side-modal-panel active" role="dialog" aria-modal="true" aria-labelledby="booking-details-title"><div className="side-modal-header"><h3 id="booking-details-title">Booking Details (#{row.id})</h3><button ref={closeButton} className="side-modal-close" aria-label="Close booking details" onClick={close}>×</button></div><div className="side-modal-body native-booking-details"><section><p className="nb-eyebrow">{row.source}</p><h2>{row.title}</h2><p>{row.departure} · {row.duration}</p><strong>{row.status}</strong></section><section><h3>Customer & travellers</h3><dl>{[["Customer", row.customer], ["Email", row.email], ["Phone", row.phone], ["Guests", row.guests.join(", ")], ["Room sharing", row.sharing], ["Boarding", row.boarding], ["Drop-off", row.dropoff]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl></section><section><h3>Payments</h3><dl>{[["Total", money(row.total, row.currency)], ["Advance", money(row.advance, row.currency)], ["Balance", money(row.balance, row.currency)], ["Adjustment", money(row.adjustment, row.currency)], ["Payment status", row.payment_status], ["Transaction", row.transaction_id], ["Payment date", row.transaction_date]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl></section><section><h3>Add-ons</h3>{row.addons.length ? row.addons.map((item, index) => <p key={index}>{item.label} × {item.qty} {item.unit} {item.price ? `· ${money(item.price * item.qty, row.currency)}` : ""} {item.detail}</p>) : <p>No Add-ons</p>}</section>{row.note && <section><h3>Booking note</h3><p>{row.note}</p></section>}<section><Link href={nativeBookingEditUrl(row.id)} prefetch={false}>Open full booking editor</Link><a href={row.invoice_url} target="_blank" rel="noopener noreferrer">Download invoice ↗</a></section></div></div></>;
}
