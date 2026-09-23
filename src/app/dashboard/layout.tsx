import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { getUserProfile } from "@/lib/wp";
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";
import "@/components/booking/booking-history.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  const profile = await getUserProfile(token);

  if (!profile) {
    // If the token is invalid or expired
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#fbfaf6]">
      <header className="border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex h-16 max-w-[820px] items-center justify-between px-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-[#3157d5]"><span aria-hidden="true">←</span> Tripanza</Link>
          <strong className="text-sm font-black text-[#151925]">Your bookings</strong>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-5 py-7 sm:py-10">
        {children}
      </main>
    </div>
  );
}
