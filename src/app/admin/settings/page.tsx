import Link from "next/link";
import { redirect } from "next/navigation";
import { adminRequest } from "@/lib/admin-settings";
import AdminSiteSettings from "@/components/admin/AdminSiteSettings";
import AdminMenu from "@/components/admin/AdminMenu";
import { getAdminIdentity } from "@/lib/admin-dashboard";
import { wordpressOrigin } from "@/lib/site-settings";
import "@/components/admin/admin-settings.css";

export const metadata = { title: "Site Settings | Tripanza Admin", robots: { index: false, follow: false } };
export default async function AdminSettingsPage() {
  const [response, admin] = await Promise.all([adminRequest("settings"), getAdminIdentity()]);
  if (response.status === 401 || response.status === 403) redirect("/");
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.settings) return <main className="admin-settings"><p className="as-eyebrow">TRIPANZA / ADMIN</p><h1>Settings are unavailable.</h1><p>Install and activate the Tripanza Site Controls plugin in WordPress, then reload this page. Your existing settings have not been changed.</p><Link href="/admin/settings">Reload settings →</Link></main>;
  if (admin.status === 401 || admin.status === 403) redirect("/");
  return <><AdminMenu name={admin.name || "Administrator"} wordpressOrigin={wordpressOrigin} /><AdminSiteSettings initial={data} /></>;
}
