export default function ToursLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-slate-50" aria-label="Loading tours">
      <div className="h-80 bg-slate-900" />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, item) => (
          <div key={item} className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="h-60 bg-slate-200" />
            <div className="space-y-4 p-6">
              <div className="h-5 w-3/4 rounded bg-slate-200" />
              <div className="h-4 rounded bg-slate-100" />
              <div className="h-16 rounded-2xl bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
