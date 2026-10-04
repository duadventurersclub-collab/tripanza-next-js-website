import { redirect } from "next/navigation";
export const metadata = { robots: { index: false, follow: false } };
export default async function BookingManagerAlias({ searchParams }: { searchParams: Promise<{ tab?: string; order_id?: string }> }) {
  const query = await searchParams;
  if (query.order_id && /^[1-9][0-9]*$/.test(query.order_id) && Number.isSafeInteger(Number(query.order_id))) redirect(`/admin/bookings/${query.order_id}/edit`);
  redirect("/admin/bookings/create" + (query.tab === "create_custom" ? "?tab=create_custom" : ""));
}
