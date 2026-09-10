export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-600">About</p>
      <h1 className="mt-3 text-4xl font-black text-slate-900">Built for a faster travel brand</h1>
      <p className="mt-6 text-lg text-slate-600">
        This frontend is separated from the WordPress backend so content, bookings, user accounts, and admin tools remain in the CMS while the public website loads fast.
      </p>
    </main>
  );
}
