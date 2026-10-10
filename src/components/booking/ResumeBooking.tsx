"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function ResumeBooking() {
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null, "", "/resume-booking");
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      queueMicrotask(() => setError("This booking link is invalid."));
      return;
    }
    fetch("/api/cart/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    }).then(async response => {
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not restore your booking.");
      window.location.replace("/cart");
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Could not restore your booking."));
  }, []);

  return <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-5 py-16">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm" aria-live="polite">
      <span className="text-xs font-black uppercase tracking-[.2em] text-[#3157d5]">Tripanza booking</span>
      <h1 className="mt-3 text-3xl font-black text-slate-950">{error ? "Booking link needs attention" : "Getting your trip ready"}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">{error || "Restoring your saved dates and travellers. We’ll check the latest availability and fare next."}</p>
      {error ? <Link href="/" className="mt-6 inline-flex rounded-xl bg-[#d0e562] px-6 py-3 text-sm font-black text-slate-950">Browse trips</Link> : <span className="mx-auto mt-6 block h-7 w-7 animate-spin rounded-full border-2 border-[#d0e562] border-t-[#3157d5]" aria-hidden="true" />}
    </section>
  </main>;
}
