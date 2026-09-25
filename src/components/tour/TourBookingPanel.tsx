"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BookingSelection } from "@/lib/booking";
import type { TourDetail } from "@/lib/wp";

type Sharing = "quad" | "triple" | "twin";
const labels: Record<Sharing, { title: string; occupancy: string }> = {
  quad: { title: "Quad Sharing", occupancy: "4 / room" },
  triple: { title: "Triple Sharing", occupancy: "3 / room" },
  twin: { title: "Twin Sharing", occupancy: "2 / room" },
};

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function dateParts(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? { day: value, month: "" }
    : {
        day: parsed.toLocaleDateString("en-IN", { day: "2-digit" }),
        month: parsed.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      };
}

function countdownParts(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

function numericValue(value?: string) {
  if (!value) return 0;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export default function TourBookingPanel({
  tour,
  mobile = false,
  onClose,
}: {
  tour: TourDetail;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const options = (["quad", "triple", "twin"] as Sharing[]).filter((key) => Boolean(tour.details.pricing[key]));
  const [sharing, setSharing] = useState<Sharing>(options[0] || "quad");
  const [travellers, setTravellers] = useState(1);
  const [departureIndex, setDepartureIndex] = useState(0);
  const [extras, setExtras] = useState<Record<string, boolean>>({});
  const [showExtras, setShowExtras] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const departure = tour.details.departures[departureIndex];
  const price = tour.details.pricing[sharing]?.amount || 0;
  const selectedExtras = tour.details.booking.extras.filter((extra) => extra.required || extras[extra.name]);
  const extrasTotal = selectedExtras.reduce((total, extra) => total + extra.price * (extra.required ? travellers : 1), 0);
  const packageAmount = price * travellers;
  const discountRate = tour.details.booking.discount_rate;
  const saleDiscount = tour.details.booking.discount_type === "amount"
    ? Math.min(packageAmount, Math.min(price, discountRate) * travellers)
    : packageAmount * (Math.min(100, discountRate) / 100);
  const afterSale = Math.max(0, packageAmount - saleDiscount);
  const sharingRules = tour.details.bulk_discounts
    .filter((rule) => rule.audience === sharing)
    .sort((left, right) => left.from - right.from);
  const activeBulkRule = [...sharingRules].reverse().find((rule) => travellers >= rule.from);
  const nextBulkRule = sharingRules.find((rule) => rule.from > travellers);
  const groupDiscount = activeBulkRule
    ? activeBulkRule.type === "amount"
      ? Math.min(afterSale, activeBulkRule.value)
      : afterSale * (Math.min(100, activeBulkRule.value) / 100)
    : 0;
  const discountedUnit = Math.max(0, price - (saleDiscount / Math.max(1, travellers)));
  const estimate = Math.max(0, afterSale - groupDiscount + extrasTotal);
  const payNow = estimate * (tour.details.booking.deposit_percentage / 100);
  const cashbackPerPerson = numericValue(tour.details.cashback);
  const cashbackTotal = cashbackPerPerson * travellers;
  const offerEnd = Date.parse(tour.details.offer.ends_at);
  const hasOfferTimer = Number.isFinite(offerEnd);
  const offerTimeLeft = hasOfferTimer && now !== null ? offerEnd - now : null;
  const offerCountdown = offerTimeLeft !== null && offerTimeLeft > 0 ? countdownParts(offerTimeLeft) : null;

  useEffect(() => {
    if (!hasOfferTimer) return;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [hasOfferTimer, offerEnd]);

  async function proceedToCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!departure || travellers < 1) {
      setError("Choose a departure and at least one traveller.");
      return;
    }

    const counts = { quad: 0, triple: 0, twin: 0 };
    counts[sharing] = travellers;
    const selection: BookingSelection = {
      tour_id: tour.id,
      date: departure.date,
      counts,
      extras: selectedExtras.map((extra) => ({ name: extra.name, quantity: extra.required ? travellers : 1 })),
    };

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      const result = (await response.json()) as { cart?: unknown; error?: string };
      if (!response.ok || !result.cart) throw new Error(result.error || "Unable to verify this booking.");
      router.push("/checkout");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue to checkout.");
      setIsSubmitting(false);
    }
  }

  return (
    <aside className={`tp-tour-sidebar${mobile ? " tp-tour-sidebar--mobile" : ""}`} aria-label="Book this tour" id={mobile ? "mobile-booking-request" : "booking-request"}>
      <form className="tp-booking-panel" onSubmit={proceedToCheckout}>
        <header className="tp-booking-panel__intro">
          <span><i className="fa-solid fa-lock" aria-hidden="true" /></span>
          <div><small>Secure booking</small><strong>Plan your trip</strong></div>
          {mobile ? <button type="button" className="tp-booking-close" onClick={onClose} aria-label="Close booking form">×</button> : null}
        </header>
        <div className="tp-booking-benefits"><span><b>✓</b><small>Your next adventure</small><strong>Plan it. Book it. Live it.</strong></span><span><i className="fa-solid fa-check" /> Secure payment</span></div>
        <ol className="tp-booking-progress" aria-label="Booking progress">{["Date", "Travellers", "Extras", "Payment"].map((label, index) => <li className={index < 3 ? "is-complete" : "is-active"} key={label}><span>{index < 3 ? "✓" : index + 1}</span><small>{label}</small></li>)}</ol>

        {discountRate > 0 || cashbackPerPerson > 0 || tour.details.offer.note || hasOfferTimer ? (
          <section className="tp-booking-offer" aria-label="Current booking offer">
            <div className="tp-booking-offer__icon"><i className="fa-solid fa-bolt" aria-hidden="true" /></div>
            <div className="tp-booking-offer__copy">
              <small>Limited-time trip offer</small>
              <strong>{tour.details.offer.note || (cashbackPerPerson > 0 ? `${money(cashbackPerPerson, tour.currency)} cashback per traveller` : "Tripanza sale price unlocked")}</strong>
              {hasOfferTimer ? (
                <span className={offerTimeLeft !== null && offerTimeLeft <= 0 ? "is-ended" : ""}>
                  {now === null ? "Checking offer time…" : offerCountdown ? `Ends in ${offerCountdown.days}d ${offerCountdown.hours}h ${offerCountdown.minutes}m ${offerCountdown.seconds}s` : "Offer deadline has ended"}
                </span>
              ) : null}
            </div>
            {discountRate > 0 ? <b>{tour.details.booking.discount_type === "percent" ? `${discountRate}% OFF` : `${money(discountRate, tour.currency)} OFF`}</b> : null}
          </section>
        ) : null}

        <section className="tp-booking-step">
          <header><span>01</span><div><strong>Select departure</strong><small>Choose the batch that works for you</small></div></header>
          {tour.details.departures.length ? <div className="tp-booking-dates">{tour.details.departures.map((item, index) => { const parts = dateParts(item.date); return <button type="button" className={index === departureIndex ? "is-active" : ""} onClick={() => { setDepartureIndex(index); setError(""); }} key={`${item.date}-${index}`}><strong>{parts.day}</strong><small>{parts.month}</small></button>; })}</div> : <p className="tp-booking-empty">No online departure is currently available.</p>}
          {departure ? <div className="tp-booking-availability"><i /><span><strong>{departure.status}</strong><small>This departure is verified again before checkout.</small></span><b>Live</b></div> : null}
        </section>

        <section className="tp-booking-step">
          <header><span>02</span><div><strong>Choose room sharing</strong><small>The package price is per traveller</small></div></header>
          <div className="tp-booking-sharing">{options.map((key) => <button type="button" className={key === sharing ? "is-active" : ""} onClick={() => { setSharing(key); setError(""); }} key={key}><strong>{labels[key].title}</strong>{key === "triple" ? <em>Recommended</em> : null}<small>{labels[key].occupancy}</small></button>)}</div>
        </section>

        <section className="tp-booking-step tp-booking-travellers">
          <header><span>03</span><div><strong>How many travellers?</strong><small>{labels[sharing].title} · {labels[sharing].occupancy}</small></div></header>
          <div className="tp-booking-counter"><button type="button" onClick={() => setTravellers((value) => Math.max(1, value - 1))} aria-label="Remove one traveller">−</button><strong>{travellers}</strong><button type="button" onClick={() => setTravellers((value) => Math.min(tour.details.capacity || 30, value + 1))} aria-label="Add one traveller">+</button></div>
        </section>

        {activeBulkRule || nextBulkRule ? (
          <div className={`tp-booking-saving${activeBulkRule ? " is-unlocked" : ""}`}>
            <b><i className={`fa-solid ${activeBulkRule ? "fa-gift" : "fa-users"}`} aria-hidden="true" /></b>
            <div>
              <strong>{activeBulkRule ? `Group discount unlocked: ${money(groupDiscount, tour.currency)} saved` : `Add ${nextBulkRule!.from - travellers} more ${nextBulkRule!.from - travellers === 1 ? "traveller" : "travellers"} to save more`}</strong>
              <small>{activeBulkRule ? `${activeBulkRule.title} applies to this ${labels[sharing].title.toLowerCase()} selection.` : `${nextBulkRule!.title}: ${nextBulkRule!.type === "percent" ? `${nextBulkRule!.value}% off` : `${money(nextBulkRule!.value, tour.currency)} off`} from ${nextBulkRule!.from} travellers.`}</small>
              {nextBulkRule ? <span aria-hidden="true"><i style={{ width: `${Math.min(100, (travellers / nextBulkRule.from) * 100)}%` }} /></span> : null}
            </div>
          </div>
        ) : null}

        <div className="tp-booking-price-card"><span><i className="fa-solid fa-check" />{labels[sharing].title}</span><strong>{saleDiscount > 0 ? <del>{money(price, tour.currency)}</del> : null}{money(discountedUnit, tour.currency)}<small>Per person</small></strong></div>

        {tour.details.booking.extras.length ? <section className="tp-booking-extras">
          <button type="button" className="tp-booking-extras__toggle" onClick={() => setShowExtras((value) => !value)} aria-expanded={showExtras}><span><b>04</b><span><strong>Optional add-ons</strong><small>{selectedExtras.length ? `${selectedExtras.length} selected` : "Optional"}</small></span></span><i className={`fa-solid fa-chevron-${showExtras ? "up" : "down"}`} aria-hidden="true" /></button>
          {showExtras ? <div className="tp-booking-extras__list">{tour.details.booking.extras.map((extra) => <label key={extra.name}><input type="checkbox" checked={extra.required || Boolean(extras[extra.name])} disabled={extra.required} onChange={(event) => setExtras((current) => ({ ...current, [extra.name]: event.target.checked }))} /><span><strong>{extra.name}</strong><small>{extra.required ? "Required for every traveller" : "Add to this booking"}</small></span><b>+{money(extra.price, tour.currency)}</b></label>)}</div> : null}
        </section> : null}

        <section className="tp-booking-total">
          <header><div><small>Your trip total</small><strong>{travellers} {travellers === 1 ? "traveller" : "travellers"} selected</strong></div><span>Verified next</span></header>
          <dl>
            <div><dt>Departure</dt><dd>{departure ? `${dateParts(departure.date).day} ${dateParts(departure.date).month}` : "Not selected"}</dd></div>
            <div><dt>{labels[sharing].title}</dt><dd>{travellers} × {money(price, tour.currency)}</dd></div>
            <div><dt>Package amount</dt><dd>{money(packageAmount, tour.currency)}</dd></div>
            {saleDiscount > 0 ? <div className="is-saving"><dt>Tripanza sale discount</dt><dd>− {money(saleDiscount, tour.currency)}</dd></div> : null}
            {groupDiscount > 0 ? <div className="is-saving"><dt>Group / bulk discount</dt><dd>− {money(groupDiscount, tour.currency)}</dd></div> : null}
            <div><dt>Add-ons</dt><dd>{extrasTotal > 0 ? money(extrasTotal, tour.currency) : "None"}</dd></div>
            {cashbackTotal > 0 ? <div className="is-cashback"><dt>Cashback after advance payment<small>{money(cashbackPerPerson, tour.currency)} × {travellers}</small></dt><dd>+ {money(cashbackTotal, tour.currency)}</dd></div> : null}
          </dl>
          <div className="tp-booking-grand"><span>Estimated booking amount<small>Taxes and final fare are verified next</small></span><strong>{money(estimate, tour.currency)}</strong></div>
          {tour.details.booking.deposit_percentage < 100 ? <div className="tp-booking-payment-split"><span>Estimated pay now<strong>{money(payNow, tour.currency)}</strong><small>{tour.details.booking.deposit_percentage}% advance</small></span><span>Estimated later<strong>{money(estimate - payNow, tour.currency)}</strong><small>Remaining trip balance</small></span></div> : null}
          {cashbackTotal > 0 ? <p className="tp-booking-cashback-note"><i className="fa-solid fa-gift" aria-hidden="true" /><span><strong>Earn {money(cashbackTotal, tour.currency)} cashback</strong> Cashback eligibility is confirmed after login and credited after the advance payment.</span></p> : null}
          {error ? <p className="tp-booking-error" role="alert">{error}</p> : null}
          <button type="submit" className="tp-booking-submit" disabled={isSubmitting || !departure}><span>{isSubmitting ? "Verifying your fare…" : "Continue to secure checkout"}</span><i className="fa-solid fa-arrow-right" /></button>
          <div className="tp-booking-assurance"><span>● Instant confirmation</span><span>● Secure payment</span></div>
        </section>
      </form>
    </aside>
  );
}
