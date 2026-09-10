import { getSessionToken } from "@/lib/session";
import { getUserProfile, getUserBookings } from "@/lib/wp";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Tripanza",
};

export default async function DashboardPage() {
  const token = (await getSessionToken()) as string; // We know it exists because of the layout
  const profile = await getUserProfile(token);
  const bookings = await getUserBookings(token);

  const displayName = profile?.first_name || profile?.display_name || "Adventurer";

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Main Content: Bookings */}
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-2xl font-black text-slate-900">Welcome back, {displayName}!</h2>
        
        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-900">
            <i className="fa-solid fa-suitcase text-emerald-500" aria-hidden="true" />
            Your Bookings
          </h3>

          {bookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <i className="fa-solid fa-plane-departure" aria-hidden="true" />
              </div>
              <h4 className="font-bold text-slate-900">No bookings yet</h4>
              <p className="mt-1 text-sm text-slate-500">Your upcoming trips will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <div key={booking.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:flex-row sm:items-center">
                  <div>
                    <h4 className="font-bold text-slate-900">{booking.title}</h4>
                    <p className="text-xs text-slate-500">
                      Order #{booking.id} • {new Date(booking.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-slate-900">
                      ₹{parseFloat(booking.amount).toLocaleString()}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      booking.status === "processing" || booking.status === "completed" 
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Sidebar: Profile Info */}
      <aside className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
            Profile Details
          </h3>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-slate-500">Name</p>
              <p className="font-bold text-slate-900">
                {profile?.first_name} {profile?.last_name}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Email</p>
              <p className="font-bold text-slate-900">{profile?.email}</p>
            </div>
            {profile?.phone && (
              <div>
                <p className="font-medium text-slate-500">Phone</p>
                <p className="font-bold text-slate-900">{profile.phone}</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
           <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-700">
            Tripanza Support
          </h3>
          <p className="text-xs font-medium text-emerald-800 mb-4 leading-relaxed">
            Need help with a booking? Our team is available 24/7 to assist you with any questions.
          </p>
          <a href="tel:+919999999999" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500">
            <i className="fa-solid fa-phone" aria-hidden="true" />
            Contact Support
          </a>
        </section>
      </aside>
    </div>
  );
}
