export type BookingMode = "standard" | "custom";
export type CreateGuest = { title: "mr" | "miss"; name: string };
export type BookingCreateFields = {
  selected_tour_id: number; custom_package_name: string; first_name: string; last_name: string; email: string; phone: string;
  check_in: string; check_out: string; duration: string; boarding: string; dropoff: string;
  adults: number; children: number; infants: number; quad_price: number; triple_price: number; twin_price: number;
  advance_payment: string; balance_due_days: number; guests: CreateGuest[];
};
export type BookingCreateData = { create_api_version: string; user: { name: string }; nonce: string; today: string; tours: { id: number; name: string }[]; standard_available: boolean; custom_available: boolean; custom_prerequisites?: { template_exists: boolean; order_type_available: boolean; traveler_table_available: boolean }; mail_available: boolean; custom_template_id: number };
export const emptyCreateFields = (mode: BookingMode): BookingCreateFields => ({ selected_tour_id: 0, custom_package_name: "", first_name: "", last_name: "", email: "", phone: "", check_in: "", check_out: "", duration: "", boarding: "", dropoff: "", adults: mode === "custom" ? 1 : 0, children: 0, infants: 0, quad_price: 0, triple_price: 0, twin_price: 0, advance_payment: "", balance_due_days: 0, guests: [{ title: "mr", name: "" }] });
export const customBookingTotal = (fields: BookingCreateFields) => Math.round((fields.adults * fields.quad_price + fields.children * fields.triple_price + fields.infants * fields.twin_price + Number.EPSILON) * 100) / 100;
