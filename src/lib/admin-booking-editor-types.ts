import type { AdminBooking } from "./admin-bookings-types";
export const EDITOR_ACTIONS = ["save", "status", "resend", "whatsapp", "reverse_wallet"] as const;
export type EditorGuest = { title: string; name: string; age: number };
export type EditorAddon = { title: string; price: number; quantity: number };
export type EditorFields = {
  selected_tour_id: number; selected_tour_name: string; boarding: string; dropoff: string;
  departure_date: string; return_date: string; starttime: string; duration: string;
  adult_number: number; child_number: number; infant_number: number; guests: EditorGuest[]; addons: EditorAddon[];
  st_first_name: string; st_last_name: string; st_phone: string; st_email: string; st_city: string; st_note: string;
  total_price: number; transaction_id: string; transaction_date: string; balance_transaction_id: string; balance_transaction_date: string;
};
export type ManualEntry = { id: string; type: "charge" | "credit"; amount: number; tax: number; total_effect: number; customer_reason: string; internal_note: string; created_at: string; user_name: string };
export type EditorFinancials = { base_total: number; booking_fee: number; tax_percent: number; gst_taxable_base: number; gst_cgst: number; gst_sgst: number; gst_igst: number; adjustment: number; adjustment_tax: number; raw_final_total: number; final_total: number; amount_paid: number; balance: number; overpayment: number; status: string };
export type EditorPricing = { prices: { adult: number; child: number; infant: number }; sale_rate: number; sale_type: "percent" | "amount"; bulk_type: "percent" | "amount"; adult_rules: { key: number; value: number }[]; child_rules: { key: number; value: number }[]; saved_group_discount: number };
export type BookingEditorData = {
  editor_api_version: string; user: { name: string }; nonce: string; revision: string; booking: AdminBooking;
  fields: EditorFields; financials: EditorFinancials; pricing: EditorPricing; auto_adjustment: number; manual_total: number; ledger: ManualEntry[];
  created: string; payment_method: string; country_code: string; status_label: string; statuses: Record<string, string>;
  host_name: string; coupon_code: string; coupon_amount: number; packages: { label: string; amount: number }[];
  tax_included: boolean; payment_urls: { payu: string; upi: string }; mail_available: boolean; whatsapp_available: boolean;
  wallet: { reversed: boolean; used: number; can_reverse: boolean }; readonly: boolean;
};
export type EditorManual = { type: "charge" | "credit"; amount: number; reason: string; internal_note: string };
export const emptyManual = (): EditorManual => ({ type: "charge", amount: 0, reason: "", internal_note: "" });
// Match PHP's half-away-from-zero rounding for negative credit/GST previews too.
const round = (value: number) => Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100 || 0;
const positive = (value: number) => Math.max(0, Number(value) || 0);
export function editorSale(fields: EditorFields, pricing: EditorPricing) {
  const gross = fields.adult_number * pricing.prices.adult + fields.child_number * pricing.prices.child + fields.infant_number * pricing.prices.infant;
  return round(Math.min(gross, pricing.sale_type === "amount" ? pricing.sale_rate * (fields.adult_number + fields.child_number + fields.infant_number) : gross * Math.min(100, pricing.sale_rate) / 100));
}
export function editorGroup(fields: EditorFields, pricing: EditorPricing) {
  function group(quantity: number, price: number, rules: { key: number; value: number }[]) {
    const subtotal = Math.max(0, quantity * price - (pricing.sale_type === "amount" ? pricing.sale_rate * quantity : quantity * price * Math.min(100, pricing.sale_rate) / 100));
    let match: { key: number; value: number } | undefined;
    for (const rule of rules) if (quantity >= rule.key && (!match || rule.key >= match.key)) match = rule;
    return !match ? 0 : round(Math.min(subtotal, pricing.bulk_type === "amount" ? match.value : subtotal * Math.min(100, match.value) / 100));
  }
  return round(group(fields.adult_number, pricing.prices.adult, pricing.adult_rules) + group(fields.child_number, pricing.prices.child, pricing.child_rules));
}
export function editorItemCost(fields: EditorFields, pricing: EditorPricing) {
  return round(fields.adult_number * pricing.prices.adult + fields.child_number * pricing.prices.child + fields.infant_number * pricing.prices.infant + fields.addons.reduce((sum, item) => sum + positive(item.price) * positive(item.quantity), 0) - editorSale(fields, pricing) - editorGroup(fields, pricing));
}
export function editorPreview(data: BookingEditorData, fields: EditorFields, manual: EditorManual) {
  const auto = round(data.auto_adjustment + editorItemCost(fields, data.pricing) - editorItemCost(data.fields, data.pricing));
  const delta = round(positive(manual.amount) * (manual.type === "credit" ? -1 : 1));
  const manualTotal = round(data.manual_total + delta), adjustment = round(auto + manualTotal), tax = round(adjustment * data.financials.tax_percent / 100);
  const rawTotal = round(data.financials.base_total + data.financials.booking_fee + adjustment + tax), total = Math.max(0, rawTotal);
  return { auto, manualTotal, adjustment, tax, rawTotal, total, manualEffect: round(delta * (1 + data.financials.tax_percent / 100)), balance: Math.max(0, round(total - fields.total_price)) };
}
export const nativeBookingEditUrl = (id: number) => `/admin/bookings/${id}/edit`;
