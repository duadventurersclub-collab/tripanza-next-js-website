import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requestBookingEditor } from "@/lib/admin-booking-editor";
import { getAdminIdentity } from "@/lib/admin-dashboard";
import { getSiteSettings, wordpressOrigin } from "@/lib/site-settings";
import AdminMenu from "@/components/admin/AdminMenu";
import AdminBookingEditor from "@/components/admin/AdminBookingEditor";
export const metadata = { title: "Edit Booking | Tripanza Admin", robots: { index: false, follow: false } };
export default async function BookingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [admin, settings] = await Promise.all([getAdminIdentity(), getSiteSettings()]); if (admin.status === 401 || admin.status === 403) redirect("/admin/login");
  if (!settings.admin_booking_editor_enabled) redirect("/admin/settings");
  if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const response = await requestBookingEditor(Number(id)); if (response.status === 401 || response.status === 403) redirect("/admin/login");
  const data = await response.json().catch(() => null);
  if (response.ok && data?.editor_api_version === "1.0.0" && data.fields && data.financials) return <AdminBookingEditor initial={data} wordpressOrigin={wordpressOrigin} />;
  return <><AdminMenu name={admin.name} wordpressOrigin={wordpressOrigin} /><main className="admin-settings"><p className="as-eyebrow">TRIPANZA / ADMIN</p><h1>Booking editor is unavailable.</h1><p>{data?.message || "Update Tripanza Native Admin API to v2.2.0 in WordPress."} Your booking has not been changed.</p><Link href="/admin/bookings">← Booking history</Link></main></>;
}
