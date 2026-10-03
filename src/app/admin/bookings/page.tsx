import { redirect } from "next/navigation";
import Link from "next/link";
import { requestAdminBookings } from "@/lib/admin-bookings";
import { getAdminIdentity } from "@/lib/admin-dashboard";
import { wordpressOrigin } from "@/lib/site-settings";
import AdminMenu from "@/components/admin/AdminMenu";
import AdminBookings from "@/components/admin/AdminBookings";
export const metadata = { title: "Global Booking History | Tripanza Admin", robots: { index: false, follow: false } };
export default async function AdminBookingsPage() {
  const response = await requestAdminBookings();
  if (response.status === 401 || response.status === 403) redirect("/");
  const data = await response.json().catch(() => null);
  if (response.ok && data?.bookings_api_version === "1.0.0" && Array.isArray(data.rows) && Array.isArray(data.archived)) return <AdminBookings initial={data} wordpressOrigin={wordpressOrigin} />;
  const admin = await getAdminIdentity();
  if (admin.status === 401 || admin.status === 403) redirect("/");
  return <><AdminMenu name={admin.name} wordpressOrigin={wordpressOrigin} /><main className="admin-settings"><p className="as-eyebrow">TRIPANZA / ADMIN</p><h1>Booking history is unavailable.</h1><p>{data?.message || "Update Tripanza Native Admin API to v2.1.0 in WordPress."} Your existing bookings have not been changed.</p><Link href="/admin/bookings">Reload booking history →</Link></main></>;
}
