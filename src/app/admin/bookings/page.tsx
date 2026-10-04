import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminIdentity } from "@/lib/admin-dashboard";
import { wordpressOrigin } from "@/lib/site-settings";
import AdminMenu from "@/components/admin/AdminMenu";
import AdminBookingsShell from "@/components/admin/AdminBookingsShell";
export const metadata = { title: "Global Booking History | Tripanza Admin", robots: { index: false, follow: false } };
export default async function AdminBookingsPage() {
  const admin = await getAdminIdentity();
  if (admin.status === 401 || admin.status === 403) redirect("/");
  if (admin.available && admin.id > 0) return <AdminBookingsShell userId={admin.id} wordpressOrigin={wordpressOrigin} />;
  return <><AdminMenu name={admin.name} wordpressOrigin={wordpressOrigin} /><main className="admin-settings"><p className="as-eyebrow">TRIPANZA / ADMIN</p><h1>Booking history is unavailable.</h1><p>Update Tripanza Native Admin API to v2.1.0 in WordPress. Your existing bookings have not been changed.</p><Link href="/admin/bookings">Reload booking history →</Link></main></>;
}
