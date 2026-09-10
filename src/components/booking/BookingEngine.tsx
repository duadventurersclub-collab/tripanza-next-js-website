"use client";

import { useState, useMemo } from "react";
import type { TourDetail } from "@/lib/wp";
import PaymentRedirectLoader from "./PaymentRedirectLoader";

interface BookingEngineProps {
  tour: TourDetail;
  dateStr: string | null;
}

export default function BookingEngine({ tour, dateStr }: BookingEngineProps) {
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [sharingType, setSharingType] = useState<"quad" | "triple" | "twin">("twin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentHtml, setPaymentHtml] = useState<string | null>(null);

  const travelers = adults + children;

  // Calculate pricing based on sharing type
  const baseTotal = useMemo(() => {
    let pricePerPerson = 0;
    if (sharingType === "quad" && tour.details.pricing.quad) {
      pricePerPerson = tour.details.pricing.quad.amount;
    } else if (sharingType === "triple" && tour.details.pricing.triple) {
      pricePerPerson = tour.details.pricing.triple.amount;
    } else if (sharingType === "twin" && tour.details.pricing.twin) {
      pricePerPerson = tour.details.pricing.twin.amount;
    } else {
      // Fallback to base price if no specific sharing pricing exists
      pricePerPerson = parseFloat(tour.price.replace(/[^0-9.]/g, "")) || 0;
    }
    return pricePerPerson * travelers;
  }, [sharingType, travelers, tour]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !phone) return;

    setIsSubmitting(true);

    try {
      const payload = {
        tour_id: tour.id,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        check_in: dateStr || "", // The backend accepts timestamp string or formatted date
        adults,
        children,
        infants: 0,
        base_total: baseTotal,
        extras_total: 0,
      };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create booking");

      const data = await res.json();
      
      // The API might return raw HTML for a payment gateway form or a redirect URL.
      if (data && typeof data === "string" && data.includes("<form")) {
        setPaymentHtml(data);
      } else if (data && data.url) {
        window.location.href = data.url;
      } else {
        // Fallback or generic success handling
        alert("Booking initiated successfully. Please wait for payment gateway instructions.");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      alert("There was an error processing your booking. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isSubmitting && !paymentHtml && <PaymentRedirectLoader />}
      
      {paymentHtml && (
        <div 
          className="hidden" 
          dangerouslySetInnerHTML={{ __html: paymentHtml }} 
          ref={(el) => {
            // Auto-submit the payment form if it's injected
            if (el) {
              const form = el.querySelector("form");
              if (form) form.submit();
            }
          }}
        />
      )}

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Configuration & Details */}
        <div className="space-y-8 lg:col-span-2">
          
          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white">1</span>
              Configure Your Trip
            </h2>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Adults (12+ yrs)</label>
                <div className="flex h-12 w-full items-center justify-between overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <button type="button" onClick={() => setAdults(Math.max(1, adults - 1))} className="flex h-full w-12 items-center justify-center text-xl text-slate-500 hover:bg-slate-200 hover:text-slate-900">−</button>
                  <span className="font-bold text-slate-900">{adults}</span>
                  <button type="button" onClick={() => setAdults(adults + 1)} className="flex h-full w-12 items-center justify-center text-xl text-slate-500 hover:bg-slate-200 hover:text-slate-900">+</button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Children (2-11 yrs)</label>
                <div className="flex h-12 w-full items-center justify-between overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <button type="button" onClick={() => setChildren(Math.max(0, children - 1))} className="flex h-full w-12 items-center justify-center text-xl text-slate-500 hover:bg-slate-200 hover:text-slate-900">−</button>
                  <span className="font-bold text-slate-900">{children}</span>
                  <button type="button" onClick={() => setChildren(children + 1)} className="flex h-full w-12 items-center justify-center text-xl text-slate-500 hover:bg-slate-200 hover:text-slate-900">+</button>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <label className="mb-3 block text-sm font-bold text-slate-700">Room Sharing Type</label>
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setSharingType("quad")}
                  disabled={!tour.details.pricing.quad}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 p-4 text-sm font-bold transition-all ${sharingType === "quad" ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"} ${!tour.details.pricing.quad ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Quad
                  <span className="mt-1 block text-[10px] font-semibold text-slate-400">4 People</span>
                  {tour.details.pricing.quad && <span className="mt-2 text-xs font-black">{tour.details.pricing.quad.display}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setSharingType("triple")}
                  disabled={!tour.details.pricing.triple}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 p-4 text-sm font-bold transition-all ${sharingType === "triple" ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"} ${!tour.details.pricing.triple ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Triple
                  <span className="mt-1 block text-[10px] font-semibold text-slate-400">3 People</span>
                  {tour.details.pricing.triple && <span className="mt-2 text-xs font-black">{tour.details.pricing.triple.display}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setSharingType("twin")}
                  disabled={!tour.details.pricing.twin}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 p-4 text-sm font-bold transition-all ${sharingType === "twin" ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"} ${!tour.details.pricing.twin ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Twin
                  <span className="mt-1 block text-[10px] font-semibold text-slate-400">2 People</span>
                  {tour.details.pricing.twin && <span className="mt-2 text-xs font-black">{tour.details.pricing.twin.display}</span>}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white">2</span>
              Contact Details
            </h2>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">First Name *</label>
                <input required type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="John" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Last Name *</label>
                <input required type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="Doe" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Email Address *</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="john@example.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Phone Number *</label>
                <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="+91 9999999999" />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Summary Card */}
        <aside className="space-y-6">
          <div className="sticky top-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-black text-slate-900">Booking Summary</h3>
            
            <div className="mb-6 flex gap-4 border-b border-slate-100 pb-6">
              {tour.featured_image && (
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  <img src={tour.featured_image} alt={tour.title} className="h-full w-full object-cover" />
                </div>
              )}
              <div>
                <h4 className="line-clamp-2 text-sm font-bold leading-tight text-slate-800">{tour.title}</h4>
                <p className="mt-1 text-xs text-slate-500">{tour.details.duration.days} Days / {tour.details.duration.nights} Nights</p>
              </div>
            </div>

            <div className="space-y-3 border-b border-slate-100 pb-6 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-slate-600">Travelers</span>
                <span className="font-bold text-slate-900">{travelers} ({adults}A, {children}C)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-600">Sharing</span>
                <span className="font-bold text-slate-900 capitalize">{sharingType}</span>
              </div>
              {dateStr && (
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Departure</span>
                  <span className="font-bold text-slate-900">
                    {/* Convert timestamp back to a readable date for display if possible, or just show the string */}
                    {dateStr}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-end justify-between">
              <span className="text-sm font-bold uppercase tracking-wide text-slate-500">Total Price</span>
              <span className="text-3xl font-black tracking-tight text-slate-900">₹{baseTotal.toLocaleString()}</span>
            </div>
            
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-medium leading-relaxed">
              <i className="fa-solid fa-shield-halved mr-1.5 text-emerald-600" aria-hidden="true" />
              Secure payment via PayU/UPI on the next step.
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                  Processing...
                </>
              ) : (
                <>
                  Proceed to Payment <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </aside>
      </form>
    </>
  );
}
