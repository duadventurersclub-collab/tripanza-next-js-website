import { redirect } from "next/navigation";
import Link from "next/link";
import { requestBookingCreate } from "@/lib/admin-booking-create";
import { getAdminIdentity } from "@/lib/admin-dashboard";
import { wordpressOrigin } from "@/lib/site-settings";
import AdminMenu from "@/components/admin/AdminMenu";
import AdminBookingCreate from "@/components/admin/AdminBookingCreate";
export const metadata = { title: "Create & Manage Bookings | Tripanza Admin", robots: { index: false, follow: false } };
export default async function BookingCreatePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const response = await requestBookingCreate();
  if ([401, 403].includes(response.status)) redirect("/");
  const data = await response.json().catch(() => null);
  if (response.ok && data?.create_api_version === "1.0.0" && Array.isArray(data.tours)) return <AdminBookingCreate initial={data} initialMode={(await searchParams).tab === "create_custom" ? "custom" : "standard"} wordpressOrigin={wordpressOrigin} />;
  const admin = await getAdminIdentity(); if ([401, 403].includes(admin.status)) redirect("/");
  return <><AdminMenu name={admin.name} wordpressOrigin={wordpressOrigin} /><main className="admin-settings"><p className="as-eyebrow">TRIPANZA / ADMIN</p><h1>Booking manager is unavailable.</h1><p>{data?.message || "Update Tripanza Native Admin API to v2.3.2 in WordPress."} No booking was created.</p><Link href="/admin/bookings/create">Reload booking manager →</Link></main></>;
}
