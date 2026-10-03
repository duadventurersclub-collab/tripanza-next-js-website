import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminIdentity, requestAdminWorkspace } from "@/lib/admin-dashboard";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminMenu from "@/components/admin/AdminMenu";
import { wordpressOrigin } from "@/lib/site-settings";
export const metadata = { title: "Admin Dashboard | Tripanza", robots: { index: false, follow: false } };
export default async function AdminPage() {
  const response = await requestAdminWorkspace();
  if (response.status === 401 || response.status === 403) redirect("/");
  const data = await response.json().catch(() => null);
  if (response.ok && data?.api_version === "2.0.0" && data?.user && Array.isArray(data?.tasks)) return <AdminDashboard initial={data} wordpressOrigin={wordpressOrigin} />;
  const admin = await getAdminIdentity();
  if (admin.status === 401 || admin.status === 403) redirect("/");
  return <><AdminMenu name={admin.name} wordpressOrigin={wordpressOrigin} /><main className="admin-settings"><p className="as-eyebrow">TRIPANZA / ADMIN</p><h1>Dashboard is unavailable.</h1><p>Install or update Tripanza Native Admin API to v2.0.0 in WordPress. The dashboard is now native Next.js; your existing tasks and plans are unchanged.</p><Link href="/admin">Reload dashboard →</Link></main></>;
}
