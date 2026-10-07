import { Metadata } from "next";
import { getSessionToken } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Login | Tripanza",
  description: "Login securely to your Tripanza account.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const requested = (await searchParams).next;
  const safeNext = typeof requested === "string" && requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") && !requested.startsWith("/login") ? requested : "/dashboard";
  const token = await getSessionToken();
  if (token) {
    redirect(safeNext);
  }

  // The shared profile modal opens the current onboarding and OTP flow here.
  return <main className="min-h-screen bg-[#f6f8fc]" />;
}
