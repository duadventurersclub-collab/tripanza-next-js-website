export default function TourDetailLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-white" aria-label="Loading tour details">
      <div className="h-16 border-b border-slate-200 bg-white" />
      <div className="h-[55vh] min-h-96 bg-slate-300" />
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-10">
        <div className="h-10 w-3/4 rounded bg-slate-200" />
        <div className="h-28 rounded-3xl bg-slate-100" />
        <div className="h-64 rounded-3xl bg-slate-100" />
      </div>
    </main>
  );
}
