"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { BookingQuote, BookingSelection } from "@/lib/booking";
import type { TourDetail } from "@/lib/wp";

type Sharing = "quad" | "triple" | "twin";
type Counts = Record<Sharing, number>;

const sharingCopy: Record<Sharing, { label: string; room: string }> = {
  quad: { label: "Quad sharing", room: "4 people / room" },
  triple: { label: "Triple sharing", room: "3 people / room" },
  twin: { label: "Twin sharing", room: "2 people / room" },
};

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export default function BookingEngine({ tour, dateStr, initialSharing = "quad", initialTravellers = 1 }: {
  tour: TourDetail;
  dateStr: string | null;
  initialSharing?: Sharing;
  initialTravellers?: number;
}) {
  const router = useRouter();
  const available = (["quad", "triple", "twin"] as Sharing[]).filter((key) => Boolean(tour.details.pricing[key]));
  const firstSharing = available.includes(initialSharing) ? initialSharing : available[0] || "quad";
  const selectedDeparture = dateStr ? tour.details.departures.find((departure) => departure.date === dateStr) : undefined;
  const hasPreselectedDeparture = Boolean(selectedDeparture);
  const [date, setDate] = useState(selectedDeparture?.date || tour.details.departures[0]?.date || "");
  const [counts, setCounts] = useState<Counts>({
    quad: firstSharing === "quad" ? Math.max(1, initialTravellers) : 0,
    triple: firstSharing === "triple" ? Math.max(1, initialTravellers) : 0,
    twin: firstSharing === "twin" ? Math.max(1, initialTravellers) : 0,
  });
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const totalTravellers = counts.quad + counts.triple + counts.twin;
  const estimate = useMemo(() => available.reduce((total, key) => total + (tour.details.pricing[key]?.amount || 0) * counts[key], 0), [available, counts, tour.details.pricing]);

  function changeCount(key: Sharing, change: number) {
    setCounts((current) => {
      const capacity = tour.details.capacity || 30;
      const currentTotal = current.quad + current.triple + current.twin;
      if (change > 0 && currentTotal >= capacity) return current;
      return { ...current, [key]: Math.max(0, current[key] + change) };
    });
    setQuote(null);
  }

  async function addToCart(event: React.FormEvent) {
    event.preventDefault();
    if (!date || totalTravellers < 1) {
      setError("Choose a departure and at least one traveller.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    const selection: BookingSelection = {
      tour_id: tour.id,
      date,
      counts,
      extras: Object.entries(extras).map(([name, quantity]) => ({ name, quantity })).filter((item) => item.quantity > 0),
    };
    try {
      const response = await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selection) });
      const result = await response.json() as { cart?: { quote: BookingQuote }; error?: string };
      if (!response.ok || !result.cart) throw new Error(result.error || "Unable to validate this booking.");
      setQuote(result.cart.quote);
      router.push("/cart");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add this trip to your cart.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={addToCart} className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-xs font-black text-white">01</span><div><h2 className="text-xl font-black text-slate-950">{hasPreselectedDeparture ? "Your selected departure" : "Select your departure"}</h2><p className="mt-1 text-sm text-slate-500">{hasPreselectedDeparture ? "Carried forward from the tour details page." : "Only live ST Tours departures can be booked."}</p></div></div>
          {hasPreselectedDeparture && selectedDeparture ? (
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><small className="font-black uppercase tracking-wider text-blue-600">Departure confirmed</small><strong className="mt-1 block text-lg text-slate-950">{new Date(`${selectedDeparture.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong><span className="mt-1 block text-xs font-semibold text-emerald-700">{selectedDeparture.status}</span></div><Link href={`/tours/${tour.slug}#booking-request`} className="text-sm font-bold text-blue-700 hover:text-blue-900">Change departure</Link></div>
          ) : (
            <><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tour.details.departures.map((departure) => <button key={departure.date} type="button" onClick={() => { setDate(departure.date); setQuote(null); }} className={`rounded-2xl border p-4 text-left transition ${date === departure.date ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/10" : "border-slate-200 hover:border-slate-300"}`}><strong className="block text-sm text-slate-950">{new Date(`${departure.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong><small className="mt-1 block text-xs font-semibold text-emerald-700">{departure.status}</small></button>)}</div>{!tour.details.departures.length ? <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">No online departure is available for this tour.</p> : null}</>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-xs font-black text-white">02</span><div><h2 className="text-xl font-black text-slate-950">Room sharing and travellers</h2><p className="mt-1 text-sm text-slate-500">The ST Tours fields map to quad, triple, and twin sharing.</p></div></div>
          <div className="mt-5 grid gap-3">
            {available.map((key) => <div key={key} className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4"><div className="min-w-0 flex-1"><strong className="block text-sm text-slate-950">{sharingCopy[key].label}</strong><small className="text-xs text-slate-500">{sharingCopy[key].room} · {tour.details.pricing[key]?.display}</small></div><div className="flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><button type="button" onClick={() => changeCount(key, -1)} className="h-full w-11 text-lg text-slate-600 hover:bg-slate-200" aria-label={`Remove ${sharingCopy[key].label} traveller`}>−</button><strong className="w-10 text-center text-sm">{counts[key]}</strong><button type="button" onClick={() => changeCount(key, 1)} className="h-full w-11 text-lg text-slate-600 hover:bg-slate-200" aria-label={`Add ${sharingCopy[key].label} traveller`}>+</button></div></div>)}
          </div>
        </section>

        {tour.details.booking.extras.length ? <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><div className="flex items-start gap-3 border-b border-slate-100 pb-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-xs font-black text-white">03</span><div><h2 className="text-xl font-black text-slate-950">Add-ons</h2><p className="mt-1 text-sm text-slate-500">Select the same extras available in ST Tours.</p></div></div><div className="mt-5 grid gap-3">{tour.details.booking.extras.map((extra) => { const quantity = extra.required ? totalTravellers : extras[extra.name] || 0; return <label key={extra.name} className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4"><input type="checkbox" checked={quantity > 0} disabled={extra.required} onChange={(event) => { setExtras((current) => ({ ...current, [extra.name]: event.target.checked ? 1 : 0 })); setQuote(null); }} className="h-5 w-5 accent-blue-600" /><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-950">{extra.name}</strong><small className="text-xs text-slate-500">{extra.required ? "Required for every traveller" : "Optional add-on"}</small></span><b className="text-sm text-slate-950">+{money(extra.price)}</b></label>; })}</div></section> : null}
      </div>

      <aside><div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl"><div className="flex gap-4 border-b border-slate-100 pb-5">{tour.featured_image ? <Image src={tour.featured_image} alt="" width={72} height={72} className="h-18 w-18 rounded-2xl object-cover" /> : null}<div><small className="font-bold uppercase tracking-wider text-blue-600">Your trip</small><h3 className="mt-1 text-sm font-black leading-snug text-slate-950">{tour.title}</h3></div></div><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Travellers</dt><dd className="font-bold">{totalTravellers}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Departure</dt><dd className="font-bold">{date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not selected"}</dd></div></dl><div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white"><small className="text-slate-400">Estimated package amount</small><strong className="mt-1 block text-2xl">{money(estimate, tour.currency)}</strong><p className="mt-2 text-[11px] leading-relaxed text-slate-400">WordPress recalculates discounts, extras, tax, and deposit before this enters your cart.</p></div>{quote ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">Validated total: {money(quote.amounts.grand_total, quote.currency)}</p> : null}{error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}<button type="submit" disabled={isSubmitting || !date || totalTravellers < 1} className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? "Validating with ST Tours…" : "Add to cart →"}</button><p className="mt-3 text-center text-[11px] font-semibold text-slate-500">Secure checkout · No amount is trusted from the browser</p></div></aside>
    </form>
  );
}
