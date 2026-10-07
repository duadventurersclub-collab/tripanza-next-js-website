"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CHECKOUT_PENDING_KEY } from "@/lib/booking-handoff";
import type { BookingSelection } from "@/lib/booking";

export default function CheckoutPreparation() {
  const router = useRouter();
  const running = useRef(false);
  const [error, setError] = useState("");

  const prepare = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setError("");
    try {
      const saved = window.sessionStorage.getItem(CHECKOUT_PENDING_KEY);
      if (!saved) throw new Error("Your trip selection is missing. Please select the date and travellers again.");
      const selection = JSON.parse(saved) as BookingSelection;
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...selection, defer_quote: true }),
      });
      const result = await response.json() as { cart?: unknown; error?: string };
      if (!response.ok || !result.cart) throw new Error(result.error || "Could not prepare your checkout.");
      window.sessionStorage.removeItem(CHECKOUT_PENDING_KEY);
      router.replace("/checkout");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not prepare your checkout.");
      running.current = false;
    }
  }, [router]);

  useEffect(() => { const timer = window.setTimeout(() => { void prepare(); }, 0); return () => window.clearTimeout(timer); }, [prepare]);

  return <main className="min-h-screen bg-slate-50 px-5 py-16"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
    <p className="text-xs font-black uppercase tracking-[.2em] text-blue-600">Secure checkout</p>
    <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Getting your trip ready.</h1>
    <p className="mt-3 text-sm leading-relaxed text-slate-600">Your selection is saved. We’re checking the live departure and final fare before you enter traveller details.</p>
    {!error ? <div className="mt-8 flex items-center gap-3 rounded-2xl bg-blue-50 p-5 text-sm font-bold text-blue-800" role="status"><span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" aria-hidden="true" />Opening checkout…</div> : <div className="mt-8 rounded-2xl bg-red-50 p-5"><p role="alert" className="text-sm font-semibold text-red-700">{error}</p><button type="button" onClick={() => void prepare()} className="mt-4 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">Try again</button></div>}
    <Link href="/?tripanza_view=all#trips" className="mt-7 inline-block text-sm font-semibold text-slate-500">Browse trips instead</Link>
  </div></main>;
}
