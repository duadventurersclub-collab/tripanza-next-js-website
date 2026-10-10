import { redirect } from "next/navigation";
import { getAdminIdentity } from "@/lib/admin-dashboard";
import AdminLoginForm from "./AdminLoginForm";
import "./admin-login.css";

export const metadata = { title: "Admin sign in | Tripanza", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const admin = await getAdminIdentity();
  if (admin.status === 200) redirect("/admin");
  return <AdminLoginForm />;
}
