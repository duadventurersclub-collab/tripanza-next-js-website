# Booking pricing contract (working draft)

The WordPress Traveler inventory, departure, sale, and group-price rules are the source of truth. Next.js displays a server-issued quote; it must not recalculate or accept client-supplied prices. Re-quote immediately before creating an order and reject a changed `quote_id`.

## Order of operations

1. Departure-specific or Traveler static sharing prices × traveller counts = package price.
2. Apply eligible per-sharing sale price and then Traveler group discounts to the trip fare. Group discounts do not reduce add-ons.
3. Add each selected add-on at its configured price × traveller count.
4. Add the tour's platform fee: global rule, custom percentage of the discounted trip plus add-ons, custom fixed amount × traveller count, or none.
5. If GST is enabled for the tour, calculate it on the discounted trip plus add-ons **and platform fee**. Delhi billing state shows the saved tax as CGST + SGST; other Indian states show IGST. When GST is disabled, tax is zero.
6. Split the resulting order total by the tour's enabled deposit percentage. If the deposit setting is off, 100% is due now.
7. Apply eligible wallet credit **after** the advance is calculated, as a payment capped at the amount due now. The payment-gateway charge is advance due minus wallet payment. The later balance is order total minus the full advance payment, including wallet credit.

All stored amounts should be rounded to two decimal places, and the quote, order snapshot, payment request, booking history, editor, emails, and invoice must reconcile to the same figures. A paid amount is not recorded merely because an order was created or a payment request was opened.

## Acceptance scenarios

- Scheduled sale active/inactive on adjacent departure dates.
- Group-discount tier boundary and mixed sharing counts.
- Required and optional add-ons with multiple travellers.
- Global percentage, global fixed, custom percentage, custom fixed-per-traveller, and fee disabled.
- Deposit off, partial deposit, full payment, and a fee split across advance and balance.
- Guest checkout; authenticated checkout with no wallet, insufficient wallet, and wallet covering the advance.
- Two simultaneous wallet bookings, payment failure, retry, cancellation/refund, and idempotent wallet reversal.
- GST disabled, GST enabled with Delhi billing state, and GST enabled with another Indian state. Check that fee-inclusive taxable base, tax components, total, and deposit reconcile to the saved order.

Run `node scripts/verify-booking-pricing.mjs TOUR_ID YYYY-MM-DD QUAD TRIPLE TWIN` to check a public, read-only quote's arithmetic. This is a smoke test, **not** a substitute for test orders and payment/wallet lifecycle checks on staging.

## Rollout status

- Local headless quote changes now use Traveler's scheduled-sale and group-pricing functions for ordinary tours, respect the enabled deposit setting, read static prices for fixed-departure tours, and calculate tour-enabled GST after the platform fee. WordPress runtime and payment testing are still required after deployment.
- The existing WordPress wallet checkout spends cashback only. Next.js still has no wallet redemption; do not subtract wallet credit from a quote or booking until an atomic debit, failed-payment release, retry, and refund path have been tested.
- `data_prices.total_price` is used for both the planned advance and the amount shown as paid in existing views. A separate confirmed-payment ledger is needed before changing those views, because the booking editor can record manual payments without changing `payment_status`.
- No live order, PayU, UPI, wallet debit, email, or refund was exercised by the read-only quote smoke test.
