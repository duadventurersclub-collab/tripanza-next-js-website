"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PaymentSession } from "@/lib/booking";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export default function PaymentExperience({ session, token, qrDataUrl }: { session: PaymentSession; token: string; qrDataUrl?: string }) {
  const router = useRouter();
  const payuForm = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const paymentHref = (method: "payu" | "upi") => `/payment/${session.booking_id}?token=${encodeURIComponent(token)}&method=${method}`;

  function openPayU() {
    if (!payuForm.current || submitting) return;
    setSubmitting(true);
    payuForm.current.submit();
  }

  async function copyUpi() {
    if (session.method !== "upi") return;
    await navigator.clipboard.writeText(session.upi.upi_id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function submitUpi(event: React.FormEvent) {
    event.preventDefault();
    if (session.method !== "upi") return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/payment/upi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: session.booking_id, token, transaction_id: transactionId, transaction_date: transactionDate }),
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || "The UPI reference could not be submitted.");
      router.replace(`/payment/result?booking_id=${session.booking_id}&token=${encodeURIComponent(token)}&state=pending`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The UPI reference could not be submitted.");
      setSubmitting(false);
    }
  }

  const payable = session.method === "payu" ? session.payable_amount : session.amount;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_4%_0,rgba(216,238,85,.24),transparent_28rem),radial-gradient(circle_at_100%_8%,rgba(49,87,213,.16),transparent_32rem),#f4f6fa] px-4 py-5 sm:px-6 sm:py-9">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => history.back()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 text-sm font-extrabold text-slate-900">← Back</button>
          <Link href="/" className="text-lg font-black tracking-tight text-slate-950">Tripanza</Link>
        </header>

        <section className="mt-10 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(26,35,66,.13)] lg:grid lg:grid-cols-[.86fr_1.14fr]">
          <aside className="bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-white sm:p-10 lg:p-12">
            <p className="text-[11px] font-black uppercase tracking-[.18em] text-lime-300">Secure Tripanza payment</p>
            <h1 className="mt-4 text-4xl font-black tracking-[-.055em] sm:text-5xl">Complete your trip payment.</h1>
            <p className="mt-5 text-sm leading-6 text-white/65">Your booking is created. Complete the selected payment below to confirm it.</p>
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[.06] p-5">
              <small className="font-bold text-white/55">Payable now</small>
              <strong className="mt-2 block text-4xl font-black tracking-tight text-lime-300">{money(payable, session.currency)}</strong>
              {session.method === "payu" ? <div className="mt-5 space-y-3 border-t border-white/10 pt-4 text-xs"><div className="flex justify-between"><span className="text-white/55">Trip advance</span><b>{money(session.amount, session.currency)}</b></div><div className="flex justify-between"><span className="text-white/55">PayU processing fee</span><b>{money(session.processing_fee, session.currency)}</b></div></div> : null}
            </div>
            <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-1">
              <div><dt className="text-[10px] font-black uppercase tracking-wider text-white/45">Selected trip</dt><dd className="mt-1 font-bold leading-5">{session.tour_title}</dd></div>
              <div><dt className="text-[10px] font-black uppercase tracking-wider text-white/45">Booking ID</dt><dd className="mt-1 font-bold">#{session.booking_id}</dd></div>
            </dl>
          </aside>

          <div className="p-5 sm:p-9 lg:p-12">
            <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1.5 text-center text-sm font-extrabold">
              <a href={paymentHref("payu")} className={`rounded-xl px-3 py-3 ${session.method === "payu" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>PayU</a>
              <a href={paymentHref("upi")} className={`rounded-xl px-3 py-3 ${session.method === "upi" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Direct UPI</a>
            </div>

            {session.method === "payu" ? (
              <div className="mt-9">
                <span className="inline-flex rounded-full border border-lime-200 bg-lime-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-lime-800">Secure PayU checkout</span>
                <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">Choose card, UPI or net banking</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Your booking stays on Tripanza. The secure authorization screen is provided by PayU, and you return here automatically after payment.</p>
                <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">↗</span><div><small className="font-bold uppercase tracking-wider text-slate-400">Secure destination</small><strong className="mt-1 block text-slate-900">secure.payu.in</strong></div></div></div>
                <button disabled={submitting} onClick={openPayU} type="button" className="mt-6 flex min-h-16 w-full items-center justify-between rounded-2xl bg-slate-950 px-5 text-left text-white shadow-xl transition hover:bg-blue-700 disabled:opacity-60"><span><small className="block text-[10px] font-black uppercase tracking-wider text-white/50">{submitting ? "Connecting securely" : "Nothing charged yet"}</small><strong className="mt-1 block text-sm">{submitting ? "Opening PayU…" : `Pay ${money(session.payable_amount, session.currency)} securely`}</strong></span><span className="grid h-11 w-11 place-items-center rounded-xl bg-lime-300 text-xl text-slate-950">→</span></button>
                <form ref={payuForm} action={session.payu.action} method="post" className="hidden">{Object.entries(session.payu.fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}</form>
              </div>
            ) : (
              <div className="mt-8 grid gap-7 xl:grid-cols-[240px_minmax(0,1fr)]">
                <div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-lg">{qrDataUrl ? <Image src={qrDataUrl} alt={`UPI QR for booking ${session.booking_id}`} width={420} height={420} unoptimized className="h-auto w-full" /> : null}</div>
                  <a href={session.upi.payment_url} className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white">Open any UPI app</a>
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-950">Pay, then submit the UTR</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Scan the QR on desktop or open an installed UPI app on mobile. Verify the payee and exact amount before approving.</p>
                  <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="min-w-0"><small className="font-bold uppercase tracking-wider text-slate-400">Official UPI ID</small><strong className="mt-1 block truncate text-sm text-slate-950">{session.upi.upi_id}</strong></div><button onClick={copyUpi} type="button" className="rounded-xl bg-blue-100 px-3 py-2 text-xs font-black text-blue-700">{copied ? "Copied" : "Copy"}</button></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-extrabold"><a href={session.upi.google_pay_url} className="rounded-xl border border-slate-200 p-3">Google Pay</a><a href={session.upi.phonepe_url} className="rounded-xl border border-slate-200 p-3">PhonePe</a><a href={session.upi.paytm_url} className="rounded-xl border border-slate-200 p-3">Paytm</a></div>
                  {session.upi.existing_transaction ? <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-800"><strong>Payment already submitted</strong><p className="mt-1">Reference {session.upi.existing_transaction} is awaiting verification.</p></div> : <form onSubmit={submitUpi} className="mt-6 space-y-4"><label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">UPI transaction ID / UTR<input required minLength={8} maxLength={50} value={transactionId} onChange={(event) => setTransactionId(event.target.value.toUpperCase())} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-base font-bold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10" placeholder="Example: 425612345678" /></label><label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Payment date<input required type="date" max={today} value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-base font-bold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10" /></label>{error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}<button disabled={submitting} className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-60">{submitting ? "Submitting securely…" : "Submit payment for verification →"}</button></form>}
                </div>
              </div>
            )}

            <p className="mt-7 rounded-2xl bg-lime-50 p-4 text-xs leading-5 text-lime-900">🛡️ Tripanza will never ask for your card PIN, UPI PIN, OTP, or screen-sharing access.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
