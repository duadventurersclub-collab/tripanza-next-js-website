export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-600">Admin</p>
      <h1 className="mt-3 text-4xl font-black text-slate-900">Admin dashboard</h1>
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">This panel will connect to the WordPress admin dashboard endpoints for orders, leads, bookings, and performance metrics.</p>
      </div>
    </main>
  );
}
