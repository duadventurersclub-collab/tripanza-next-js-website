export default function BookingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-600">Booking</p>
      <h1 className="mt-3 text-4xl font-black text-slate-900">Create your booking</h1>
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">This is the booking entry page. In production, the frontend will submit to the WordPress headless booking endpoint and then redirect to checkout.</p>
      </div>
    </main>
  );
}
