import { Metadata } from "next";
import OtpLoginForm from "@/components/auth/OtpLoginForm";
import { getSessionToken } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Login | Tripanza",
  description: "Login securely to your Tripanza account.",
};

export default async function LoginPage() {
  // If already logged in, redirect to dashboard
  const token = await getSessionToken();
  if (token) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-50 py-20 px-6 sm:py-32">
      <OtpLoginForm />
    </main>
  );
}
