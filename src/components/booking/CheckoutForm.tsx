"use client";

import { useState } from "react";
import type { BookingQuote, BookingTraveller } from "@/lib/booking";
import PaymentRedirectLoader from "./PaymentRedirectLoader";

type Contact = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  note: string;
};

const blankContact: Contact = { first_name: "", last_name: "", email: "", phone: "", address: "", city: "", province: "", postal_code: "", country: "India", note: "" };

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export default function CheckoutForm({ quote, requireGuestNames }: { quote: BookingQuote; requireGuestNames: boolean }) {
  const [contact, setContact] = useState(blankContact);
  const [travellers, setTravellers] = useState<BookingTraveller[]>(() => Array.from({ length: quote.travellers.total }, () => ({ title: "Mr", name: "", age: undefined })));
  const [paymentMethod, setPaymentMethod] = useState<"payu" | "upi">("payu");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey] = useState(() => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  function updateContact(key: keyof Contact, value: string) {
    setContact((current) => ({ ...current, [key]: value }));
  }

  function updateTraveller(index: number, key: keyof BookingTraveller, value: string) {
    setTravellers((current) => current.map((traveller, itemIndex) => itemIndex === index ? { ...traveller, [key]: key === "age" ? Number(value) || undefined : value } : traveller));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (requireGuestNames && travellers.some((traveller) => !traveller.name.trim())) {
      setError("Enter the full name of every traveller.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, travellers, payment_method: paymentMethod, idempotency_key: idempotencyKey }),
      });
      const result = await response.json() as { payment_url?: string; error?: string };
      if (!response.ok || !result.payment_url) throw new Error(result.error || "The payment handoff could not be prepared.");
      window.location.assign(result.payment_url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout could not be started.");
      setSubmitting(false);
    }
  }

  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10";
  return (
    <>
      {submitting ? <PaymentRedirectLoader /> : null}
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-xs font-black text-white">01</span><div><h2 className="text-xl font-black text-slate-950">Contact details</h2><p className="mt-1 text-sm text-slate-500">We’ll send booking and payment updates here.</p></div></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">First name *<input className={inputClass} required autoComplete="given-name" value={contact.first_name} onChange={(event) => updateContact("first_name", event.target.value)} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Last name *<input className={inputClass} required autoComplete="family-name" value={contact.last_name} onChange={(event) => updateContact("last_name", event.target.value)} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Email *<input className={inputClass} type="email" required autoComplete="email" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Phone *<input className={inputClass} type="tel" required minLength={7} autoComplete="tel" value={contact.phone} onChange={(event) => updateContact("phone", event.target.value)} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 sm:col-span-2">Address<input className={inputClass} autoComplete="street-address" value={contact.address} onChange={(event) => updateContact("address", event.target.value)} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">City<input className={inputClass} autoComplete="address-level2" value={contact.city} onChange={(event) => updateContact("city", event.target.value)} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">State<input className={inputClass} autoComplete="address-level1" value={contact.province} onChange={(event) => updateContact("province", event.target.value)} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Postal code<input className={inputClass} autoComplete="postal-code" value={contact.postal_code} onChange={(event) => updateContact("postal_code", event.target.value)} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Country<input className={inputClass} autoComplete="country-name" value={contact.country} onChange={(event) => updateContact("country", event.target.value)} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 sm:col-span-2">Booking note<textarea className={`${inputClass} min-h-24 py-3`} value={contact.note} onChange={(event) => updateContact("note", event.target.value)} placeholder="Dietary needs, pickup notes, or anything we should know" /></label>
            </div>
          </section>

          {requireGuestNames ? <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-xs font-black text-white">02</span><div><h2 className="text-xl font-black text-slate-950">Traveller details</h2><p className="mt-1 text-sm text-slate-500">Names must match the travellers joining the trip.</p></div></div><div className="grid gap-4">{travellers.map((traveller, index) => <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[90px_minmax(0,1fr)_100px]" key={index}><label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Title<select className={inputClass} value={traveller.title} onChange={(event) => updateTraveller(index, "title", event.target.value)}><option>Mr</option><option>Ms</option><option>Mrs</option><option>Dr</option></select></label><label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Traveller {index + 1} name *<input className={inputClass} required value={traveller.name} onChange={(event) => updateTraveller(index, "name", event.target.value)} /></label><label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Age<input className={inputClass} type="number" min="1" max="110" value={traveller.age || ""} onChange={(event) => updateTraveller(index, "age", event.target.value)} /></label></div>)}</div></section> : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-xs font-black text-white">{requireGuestNames ? "03" : "02"}</span><div><h2 className="text-xl font-black text-slate-950">Payment method</h2><p className="mt-1 text-sm text-slate-500">Continue to Tripanza’s existing secure payment page.</p></div></div><div className="grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-2xl border p-4 ${paymentMethod === "payu" ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/10" : "border-slate-200"}`}><input type="radio" name="payment" value="payu" checked={paymentMethod === "payu"} onChange={() => setPaymentMethod("payu")} className="accent-blue-600" /><strong className="ml-3 text-sm text-slate-950">PayU</strong><small className="mt-2 block text-xs text-slate-500">Cards, UPI and net banking</small></label><label className={`cursor-pointer rounded-2xl border p-4 ${paymentMethod === "upi" ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/10" : "border-slate-200"}`}><input type="radio" name="payment" value="upi" checked={paymentMethod === "upi"} onChange={() => setPaymentMethod("upi")} className="accent-blue-600" /><strong className="ml-3 text-sm text-slate-950">Direct UPI</strong><small className="mt-2 block text-xs text-slate-500">QR and installed UPI apps</small></label></div></section>
        </div>

        <aside><div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"><small className="font-black uppercase tracking-wider text-blue-600">Final step</small><h2 className="mt-2 text-lg font-black text-slate-950">{quote.tour.title}</h2><dl className="mt-5 space-y-3 border-b border-slate-100 pb-5 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Departure</dt><dd className="font-bold">{quote.departure.date}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Travellers</dt><dd className="font-bold">{quote.travellers.total}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Trip total</dt><dd className="font-bold">{money(quote.amounts.grand_total, quote.currency)}</dd></div></dl><div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white"><small className="text-slate-400">Pay securely now</small><strong className="mt-1 block text-3xl">{money(quote.amounts.pay_now, quote.currency)}</strong>{quote.amounts.pay_later > 0 ? <p className="mt-2 text-xs text-slate-400">Balance {money(quote.amounts.pay_later, quote.currency)} due later.</p> : null}</div>{error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}<button disabled={submitting} type="submit" className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">{submitting ? "Creating secure booking…" : `Confirm and pay ${money(quote.amounts.pay_now, quote.currency)} →`}</button><p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">Your ST Tours order is created only after WordPress revalidates the fare. Payment details stay with the selected provider.</p></div></aside>
      </form>
    </>
  );
}
