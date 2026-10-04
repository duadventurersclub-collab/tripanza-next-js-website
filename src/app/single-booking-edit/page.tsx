import { redirect } from "next/navigation";
export default async function LegacyBookingEdit({ searchParams }: { searchParams: Promise<{ order_id?: string | string[] }> }) {
  const { order_id } = await searchParams;
  redirect(typeof order_id === "string" && /^[1-9][0-9]*$/.test(order_id) && Number.isSafeInteger(Number(order_id)) ? `/admin/bookings/${order_id}/edit` : "/admin/bookings");
}
