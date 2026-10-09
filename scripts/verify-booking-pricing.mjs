#!/usr/bin/env node

// Read-only quote smoke test. It does not create an order or initiate payment.
const [tourId, date, quad = "1", triple = "0", twin = "0", origin = "https://tripanza.com"] = process.argv.slice(2);
if (!Number.isInteger(Number(tourId)) || Number(tourId) < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
  console.error("Usage: node scripts/verify-booking-pricing.mjs TOUR_ID YYYY-MM-DD [QUAD] [TRIPLE] [TWIN] [WORDPRESS_ORIGIN]");
  process.exit(2);
}

const counts = { quad: Number(quad), triple: Number(triple), twin: Number(twin) };
if (Object.values(counts).some(value => !Number.isSafeInteger(value) || value < 0) || Object.values(counts).every(value => value === 0)) {
  console.error("Traveller counts must be nonnegative integers with at least one traveller.");
  process.exit(2);
}

const cents = value => Math.round(Number(value) * 100);
const near = (actual, expected, label) => {
  if (Math.abs(actual - expected) > 1) throw new Error(`${label}: expected ${expected / 100}, received ${actual / 100}`);
};

try {
  const response = await fetch(`${origin.replace(/\/$/, "")}/wp-json/tripanza-headless/v1/booking/quote`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ tour_id: Number(tourId), date, counts, extras: [] }),
  });
  const quote = await response.json();
  if (!response.ok) throw new Error(`Quote failed (${response.status}): ${quote.message || "unknown error"}`);

  const amount = quote.amounts;
  near(cents(amount.package) - cents(amount.sale_discount) - cents(amount.group_discount) + cents(amount.extras), cents(amount.trip_total), "Trip subtotal");
  near(cents(amount.trip_total) + cents(amount.tax) + cents(amount.booking_fee || 0), cents(amount.grand_total), "Grand total");
  if (quote.tax) {
    near(cents(amount.trip_total) + cents(amount.booking_fee || 0), cents(quote.tax.taxable_base), "GST taxable base includes platform fee");
    near(cents(quote.tax.taxable_base * quote.tax.rate / 100), cents(amount.tax), "GST on fee-inclusive base");
  }
  near(cents(amount.pay_now) + cents(amount.pay_later), cents(amount.grand_total), "Payment split");
  near(cents(amount.grand_total * quote.deposit.percentage / 100), cents(amount.pay_now), "Advance");

  console.log(JSON.stringify({
    tour: quote.tour.title,
    date: quote.departure.date,
    travellers: quote.travellers.total,
    package: amount.package,
    sale_discount: amount.sale_discount,
    group_discount: amount.group_discount,
    extras: amount.extras,
    platform_fee: amount.booking_fee || 0,
    tax: amount.tax,
    grand_total: amount.grand_total,
    pay_now: amount.pay_now,
    pay_later: amount.pay_later,
    result: "arithmetic checks passed",
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
