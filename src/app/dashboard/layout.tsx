import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { getUserProfile } from "@/lib/wp";
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";

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
    <div className="min-h-screen bg-slate-50">
      {/* Dashboard Navigation */}
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-black text-slate-900">My Account</h1>
            <nav className="hidden sm:flex gap-6">
              <Link href="/dashboard" className="text-sm font-bold text-emerald-600">
                Dashboard
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm font-medium text-slate-500">
              {profile.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
