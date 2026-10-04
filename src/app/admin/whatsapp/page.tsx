import { redirect } from "next/navigation";
import { getAdminIdentity } from "@/lib/admin-dashboard";
import { wordpressOrigin } from "@/lib/site-settings";
import AdminMenu from "@/components/admin/AdminMenu";
import AdminWhatsApp from "@/components/admin/AdminWhatsApp";

export const metadata = { title: "WhatsApp Bots | Tripanza Admin", robots: { index: false, follow: false } };

export default async function Page() {
  const admin = await getAdminIdentity();
  if (admin.status !== 200) redirect("/");
  return <><AdminMenu name={admin.name || "Administrator"} wordpressOrigin={wordpressOrigin} /><AdminWhatsApp /></>;
}
