export type BookingAddon = { key: string; label: string; qty: number; unit: string; price: number; detail: string };
export type AdminBooking = {
  id: number; item_id: number; revision: string; editable: boolean; archived: boolean; archived_at: string;
  date: string; departure: string; checkout: string; duration: string; title: string; trip_label: string;
  source: string; poster: string; host: string; owner: string; inventory_id: number; storefront_id: number;
  trip_url: string; inventory_url: string; edit_url: string; invoice_url: string;
  customer: string; email: string; phone: string; guests: string[]; male: number; female: number;
  quad: number; triple: number; twin: number; persons: number; sharing: string; addons: BookingAddon[];
  currency: string; total: number; advance: number; balance: number; adjustment: number;
  status_key: string; status: string; payment_status: string; transaction_id: string; transaction_date: string;
  note: string; boarding: string; dropoff: string;
};
export type AdminBookingsData = { bookings_api_version: string; user: { name: string }; nonce: string; today: string; rows: AdminBooking[]; archived: AdminBooking[]; statuses: Record<string, string>; total: number; archive_total: number; page: number; per_page: number; mail_available: boolean };
export const BOOKING_ACTIONS = ["status", "adjustment", "resend", "archive", "restore", "purge"] as const;
export const BOOKING_COLUMNS = ["S.no.", "#ID", "Departure", "Trip", "Customer", "Phone", "Person", "Add-ons", "Total", "Advance", "Balance", "Adjustment", "Payment", "Status", "Details", "Edit", "Invoice"];
export const BOOKING_WIDTHS = [70, 75, 145, 220, 200, 130, 120, 180, 110, 110, 110, 125, 155, 120, 90, 85, 135];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const money = (value: number, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
export function bookingSummary(rows: AdminBooking[]) {
  const sums = { count: rows.length, quad: 0, triple: 0, twin: 0, persons: 0, male: 0, female: 0, total: 0, advance: 0, balance: 0, addons: [] as BookingAddon[] };
  const addons = new Map<string, BookingAddon>();
  for (const row of rows) {
    for (const key of ["quad", "triple", "twin", "persons", "male", "female", "total", "advance", "balance"] as const) sums[key] += row[key];
    for (const item of row.addons) { const prev = addons.get(item.key); addons.set(item.key, { ...item, qty: (prev?.qty || 0) + item.qty }); }
  }
  sums.addons = [...addons.values()];
  return { ...sums, quadRooms: Math.ceil(sums.quad / 4), tripleRooms: Math.ceil(sums.triple / 3), twinRooms: Math.ceil(sums.twin / 2) };
}
export function bookingMatches(row: AdminBooking, query: string, trip: string, status: string, poster: string) {
  return (!query || `${row.id} ${row.date} ${row.date.split("-").reverse().join("-")} ${row.departure} ${row.customer} ${row.phone} ${row.email}`.toLowerCase().includes(query.trim().toLowerCase()))
    && (!trip || row.trip_label.toLowerCase().includes(trip.trim().toLowerCase())) && (!status || row.status === status) && (!poster || row.poster === poster);
}
export function bookingAnalytics(rows: AdminBooking[], currentYear: number, year: string, month: string) {
  const current = Array<number>(12).fill(0), previous = Array<number>(12).fill(0);
  const genders = Array.from({ length: 4 }, () => Array<number>(12).fill(0));
  const confirmed = rows.filter(row => ["fully paid", "partially paid"].includes(row.status.toLowerCase()));
  for (const row of confirmed) {
    const y = Number(row.date.slice(0, 4)), m = Number(row.date.slice(5, 7)) - 1;
    if (m < 0 || m > 11 || !Number.isInteger(m)) continue;
    if (y === currentYear) { current[m] += row.total; genders[0][m] += row.male; genders[1][m] += row.female; }
    if (y === currentYear - 1) { previous[m] += row.total; genders[2][m] += row.male; genders[3][m] += row.female; }
  }
  return { ...bookingSummary(confirmed.filter(row => (year === "all" || row.date.slice(0, 4) === year) && (month === "all" || Number(row.date.slice(5, 7)) - 1 === Number(month)))), current, previous, genders };
}
export function coordinatorMessage(rows: AdminBooking[]) {
  const groups = new Map<string, AdminBooking[]>();
  for (const row of rows) { const key = `${row.trip_label} - ${row.departure}`; groups.set(key, [...(groups.get(key) || []), row]); }
  return [...groups].map(([key, group]) => {
    const summary = bookingSummary(group), balance = group.filter(row => row.status.toLowerCase() === "partially paid").reduce((sum, row) => sum + Math.max(0, row.balance), 0);
    return `*${key}*\n\nTotal Persons: ${summary.persons}\nTotal Male: ${summary.male}\nTotal Female: ${summary.female}${balance > 0 ? `\nTotal Balance to collect: ${money(balance)}` : ""}\n\n` + group.map((row, index) => `*Booking ${index + 1} (#${row.id})*\nCustomer: ${row.customer}\nPhone: ${row.phone}\nPersons: ${row.persons}${row.guests.length ? `\nGuests: ${row.guests.join(", ")}` : ""}\nRoom Sharing: ${row.sharing}${row.addons.length ? `\nAdd-ons: ${row.addons.map(item => `${item.label} (${item.qty} ${item.unit})`).join("; ")}` : ""}${row.status.toLowerCase() === "partially paid" && row.balance > 0 ? `\nBalance to collect: ${money(row.balance, row.currency)}` : ""}`).join("\n\n");
  }).join("\n\n--------------------\n\n");
}
