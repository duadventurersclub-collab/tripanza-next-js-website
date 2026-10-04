import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminIdentity } from "@/lib/admin-dashboard";
import AdminDashboardShell from "@/components/admin/AdminDashboardShell";
import AdminMenu from "@/components/admin/AdminMenu";
import { wordpressOrigin } from "@/lib/site-settings";
export const metadata = { title: "Admin Dashboard | Tripanza", robots: { index: false, follow: false } };
export default async function AdminPage() {
  const admin = await getAdminIdentity();
  if (admin.status === 401 || admin.status === 403) redirect("/");
  if (admin.available && admin.id > 0) return <AdminDashboardShell userId={admin.id} wordpressOrigin={wordpressOrigin} />;
  return <><AdminMenu name={admin.name} wordpressOrigin={wordpressOrigin} /><main className="admin-settings"><p className="as-eyebrow">TRIPANZA / ADMIN</p><h1>Dashboard is unavailable.</h1><p>Install or update Tripanza Native Admin API to v2.0.0 in WordPress. The dashboard is now native Next.js; your existing tasks and plans are unchanged.</p><Link href="/admin">Reload dashboard →</Link></main></>;
}
