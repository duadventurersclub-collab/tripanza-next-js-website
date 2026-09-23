"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingQuote, BookingTraveller } from "@/lib/booking";
import type { TourDetail } from "@/lib/st-tours";
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

type CheckoutFormProps = {
  quote: BookingQuote;
  tour: TourDetail | null;
  requireGuestNames: boolean;
};

const blankContact: Contact = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  postal_code: "",
  country: "India",
  note: "",
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function displayDate(value: string, fallback?: string) {
  if (fallback) return fallback;
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SummaryRow({
  label,
  value,
  detail,
  saving = false,
  strong = false,
}: {
  label: string;
  value: string;
  detail?: string;
  saving?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 ${strong ? "text-base font-black text-slate-950" : "text-sm"}`}>
      <dt className={strong ? "" : "text-slate-600"}>
        {label}
        {detail ? <small className="mt-0.5 block text-[10px] font-semibold text-slate-400">{detail}</small> : null}
      </dt>
      <dd className={`shrink-0 font-bold ${saving ? "text-emerald-600" : "text-slate-950"}`}>{value}</dd>
    </div>
  );
}

export default function CheckoutForm({ quote, tour, requireGuestNames }: CheckoutFormProps) {
  const router = useRouter();
  const [contact, setContact] = useState(blankContact);
  const [travellers, setTravellers] = useState<BookingTraveller[]>(() =>
    Array.from({ length: quote.travellers.total }, () => ({ title: "Mr", name: "", age: undefined })),
  );
  const [paymentMethod, setPaymentMethod] = useState<"payu" | "upi">("payu");
  const [billingOpen, setBillingOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  );

  function updateContact(key: keyof Contact, value: string) {
    setContact((current) => ({ ...current, [key]: value }));
  }

  function updateTraveller(index: number, key: keyof BookingTraveller, value: string) {
    setTravellers((current) =>
      current.map((traveller, itemIndex) =>
        itemIndex === index
          ? { ...traveller, [key]: key === "age" ? Number(value) || undefined : value }
          : traveller,
      ),
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (requireGuestNames && travellers.some((traveller) => !traveller.name.trim())) {
      setError("Enter the full name of every traveller.");
      return;
    }
    if (!termsAccepted) {
      setError("Please accept the booking terms and cancellation policy to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact,
          travellers,
          payment_method: paymentMethod,
          idempotency_key: idempotencyKey,
        }),
      });
      const result = (await response.json()) as { booking_id?: number; order_token?: string; error?: string };
      if (!response.ok || !result.booking_id || !result.order_token) {
        throw new Error(result.error || "The payment handoff could not be prepared.");
      }
      router.push(
        `/payment/${result.booking_id}?token=${encodeURIComponent(result.order_token)}&method=${paymentMethod}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout could not be started.");
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10";
  const duration = tour?.details.duration.days
    ? `${tour.details.duration.days} days / ${tour.details.duration.nights} nights`
    : "";
  const sharingLines = [
    { label: "Quad sharing", count: quote.travellers.quad, unit: quote.unit_prices.quad },
    { label: "Triple sharing", count: quote.travellers.triple, unit: quote.unit_prices.triple },
    { label: "Twin sharing", count: quote.travellers.twin, unit: quote.unit_prices.twin },
  ].filter((line) => line.count > 0);
  const totalSavings = quote.amounts.sale_discount + quote.amounts.group_discount;

  return (
    <>
      {submitting ? <PaymentRedirectLoader /> : null}
      <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-xs font-black text-white">01</span>
              <div>
                <h2 className="text-xl font-black text-slate-950">Contact details</h2>
                <p className="mt-1 text-sm text-slate-500">Your confirmation and trip updates will be sent here.</p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                First name *
                <input className={inputClass} required autoComplete="given-name" value={contact.first_name} onChange={(event) => updateContact("first_name", event.target.value)} />
              </label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                Last name *
                <input className={inputClass} required autoComplete="family-name" value={contact.last_name} onChange={(event) => updateContact("last_name", event.target.value)} />
              </label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                Email address *
                <input className={inputClass} type="email" required autoComplete="email" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} />
              </label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                Phone number *
                <input className={inputClass} type="tel" required minLength={7} autoComplete="tel" value={contact.phone} onChange={(event) => updateContact("phone", event.target.value)} />
              </label>
            </div>

            <button
              type="button"
              aria-expanded={billingOpen}
              onClick={() => setBillingOpen((open) => !open)}
              className="mt-5 flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-left text-sm font-bold text-slate-700"
            >
              <span>Add billing information or a booking note</span>
              <span className="text-xl font-medium text-blue-600">{billingOpen ? "−" : "+"}</span>
            </button>

            {billingOpen ? (
              <div className="mt-5 grid gap-5 border-t border-dashed border-slate-200 pt-5 sm:grid-cols-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 sm:col-span-2">Address<input className={inputClass} autoComplete="street-address" value={contact.address} onChange={(event) => updateContact("address", event.target.value)} /></label>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">City<input className={inputClass} autoComplete="address-level2" value={contact.city} onChange={(event) => updateContact("city", event.target.value)} /></label>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">State<input className={inputClass} autoComplete="address-level1" value={contact.province} onChange={(event) => updateContact("province", event.target.value)} /></label>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">Postal code<input className={inputClass} autoComplete="postal-code" value={contact.postal_code} onChange={(event) => updateContact("postal_code", event.target.value)} /></label>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">Country<input className={inputClass} autoComplete="country-name" value={contact.country} onChange={(event) => updateContact("country", event.target.value)} /></label>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 sm:col-span-2">Booking note<textarea className={`${inputClass} min-h-24 py-3`} value={contact.note} onChange={(event) => updateContact("note", event.target.value)} placeholder="Dietary needs, pickup notes, or anything we should know" /></label>
              </div>
            ) : null}
          </section>

          {requireGuestNames ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-xs font-black text-white">02</span>
                <div><h2 className="text-xl font-black text-slate-950">Traveller details</h2><p className="mt-1 text-sm text-slate-500">Names must match the travellers joining the trip.</p></div>
              </div>
              <div className="grid gap-4">
                {travellers.map((traveller, index) => (
                  <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[90px_minmax(0,1fr)_100px]" key={index}>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Title<select className={inputClass} value={traveller.title} onChange={(event) => updateTraveller(index, "title", event.target.value)}><option>Mr</option><option>Ms</option><option>Mrs</option><option>Dr</option></select></label>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Traveller {index + 1} name *<input className={inputClass} required value={traveller.name} onChange={(event) => updateTraveller(index, "name", event.target.value)} /></label>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Age<input className={inputClass} type="number" min="1" max="110" value={traveller.age || ""} onChange={(event) => updateTraveller(index, "age", event.target.value)} /></label>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-xs font-black text-white">{requireGuestNames ? "03" : "02"}</span>
              <div><h2 className="text-xl font-black text-slate-950">Payment method</h2><p className="mt-1 text-sm text-slate-500">Choose how you want to complete the secure payment.</p></div>
              <small className="ml-auto hidden rounded-full bg-lime-100 px-3 py-1.5 text-[10px] font-black uppercase text-lime-800 sm:block">✓ Secure</small>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`cursor-pointer rounded-2xl border p-4 transition ${paymentMethod === "payu" ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/10" : "border-slate-200 hover:border-slate-300"}`}>
                <input type="radio" name="payment" value="payu" checked={paymentMethod === "payu"} onChange={() => setPaymentMethod("payu")} className="accent-blue-600" />
                <strong className="ml-3 text-sm text-slate-950">PayU</strong>
                <small className="mt-2 block text-xs text-slate-500">Cards, UPI and net banking</small>
              </label>
              <label className={`cursor-pointer rounded-2xl border p-4 transition ${paymentMethod === "upi" ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/10" : "border-slate-200 hover:border-slate-300"}`}>
                <input type="radio" name="payment" value="upi" checked={paymentMethod === "upi"} onChange={() => setPaymentMethod("upi")} className="accent-blue-600" />
                <strong className="ml-3 text-sm text-slate-950">Direct UPI</strong>
                <small className="mt-2 block text-xs text-slate-500">QR and installed UPI apps</small>
              </label>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">🔒 Your payment details are encrypted and processed by the selected provider.</p>
          </section>
        </div>

        <aside>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl lg:sticky lg:top-6 sm:p-6">
            <div className="flex gap-4 border-b border-slate-100 pb-5">
              {quote.tour.image ? <Image src={quote.tour.image} alt="" width={96} height={96} className="h-24 w-24 shrink-0 rounded-2xl object-cover" /> : null}
              <div className="min-w-0">
                <small className="font-black uppercase tracking-wider text-blue-600">Your trip</small>
                <h2 className="mt-1 text-base font-black leading-snug text-slate-950">{quote.tour.title}</h2>
                {tour?.details.address ? <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">📍 {tour.details.address}</p> : null}
              </div>
            </div>

            <section className="border-b border-slate-100 py-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-950">Trip details</h3>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-xs text-slate-500">Check-in</dt><dd className="mt-1 font-bold text-slate-950">{displayDate(quote.departure.check_in || quote.departure.date, quote.departure.display_date)}</dd></div>
                <div><dt className="text-xs text-slate-500">Check-out</dt><dd className="mt-1 font-bold text-slate-950">{displayDate(quote.departure.check_out)}</dd></div>
                {duration ? <div><dt className="text-xs text-slate-500">Duration</dt><dd className="mt-1 font-bold text-slate-950">{duration}</dd></div> : null}
                <div><dt className="text-xs text-slate-500">Travellers</dt><dd className="mt-1 font-bold text-slate-950">{quote.travellers.total} {quote.travellers.total === 1 ? "person" : "people"}</dd></div>
              </dl>
            </section>

            <section className="border-b border-slate-100 py-5">
              <div className="flex items-end justify-between gap-3"><h3 className="text-xs font-black uppercase tracking-wider text-slate-950">Booking items</h3><small className="text-[10px] font-semibold text-slate-400">Server validated</small></div>
              <dl className="mt-4 space-y-3.5">
                {sharingLines.map((line) => <SummaryRow key={line.label} label={line.label} detail={`${line.count} × ${money(line.unit, quote.currency)}`} value={money(line.count * line.unit, quote.currency)} />)}
                {quote.extras.map((extra) => <SummaryRow key={extra.name} label={extra.name} detail={`${extra.quantity} × ${money(extra.price, quote.currency)}${extra.required ? " · Required" : ""}`} value={money(extra.total, quote.currency)} />)}
                {!sharingLines.length && !quote.extras.length ? <p className="text-sm text-slate-500">Your selected tour package.</p> : null}
              </dl>
            </section>

            <section className="py-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-950">Fare breakdown</h3>
              <dl className="mt-4 space-y-3">
                <SummaryRow label="Package amount" value={money(quote.amounts.package, quote.currency)} />
                {quote.amounts.sale_discount > 0 ? <SummaryRow label="Sale discount" saving value={`− ${money(quote.amounts.sale_discount, quote.currency)}`} /> : null}
                {quote.amounts.group_discount > 0 ? <SummaryRow label="Group discount" saving value={`− ${money(quote.amounts.group_discount, quote.currency)}`} /> : null}
                {quote.amounts.extras > 0 ? <SummaryRow label="Add-ons" value={money(quote.amounts.extras, quote.currency)} /> : null}
                {quote.amounts.tax > 0 ? <SummaryRow label="Taxes and fees" value={money(quote.amounts.tax, quote.currency)} /> : null}
                <div className="border-t border-dashed border-slate-200 pt-3"><SummaryRow label="Trip total" strong value={money(quote.amounts.grand_total, quote.currency)} /></div>
                {totalSavings > 0 ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">You save {money(totalSavings, quote.currency)} on this booking.</p> : null}
              </dl>
            </section>

            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <div className="flex items-start justify-between gap-3"><div><small className="text-slate-400">Pay securely now</small><strong className="mt-1 block text-3xl">{money(quote.amounts.pay_now, quote.currency)}</strong></div>{quote.deposit.percentage > 0 && quote.deposit.percentage < 100 ? <span className="rounded-full bg-lime-300 px-2.5 py-1 text-[10px] font-black text-slate-950">{quote.deposit.percentage}% advance</span> : null}</div>
              {quote.amounts.pay_later > 0 ? <p className="mt-2 text-xs text-slate-400">Remaining balance {money(quote.amounts.pay_later, quote.currency)} is payable later.</p> : <p className="mt-2 text-xs text-slate-400">This completes the full trip payment.</p>}
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-relaxed text-slate-600">
              <input type="checkbox" required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" />
              <span>I agree to Tripanza&apos;s <a href="https://tripanza.com/tnc/" target="_blank" rel="noreferrer" className="font-black text-blue-600 hover:underline">terms and conditions</a> and <a href="https://tripanza.com/cancellation-policy/" target="_blank" rel="noreferrer" className="font-black text-blue-600 hover:underline">cancellation policy</a>.</span>
            </label>

            {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
            <button disabled={submitting || !termsAccepted} type="submit" className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Creating secure booking…" : `Confirm and pay ${money(quote.amounts.pay_now, quote.currency)} →`}</button>
            <div className="mt-4 flex items-center justify-center gap-4 text-[10px] font-bold text-slate-500"><span>🔒 Encrypted payment</span><span>✓ Traveller protected</span></div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">Your ST Tours order is created only after WordPress revalidates the fare. Payment details stay with the selected provider.</p>
          </div>
        </aside>
      </form>
    </>
  );
}
