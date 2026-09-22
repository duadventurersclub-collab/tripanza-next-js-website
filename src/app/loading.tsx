export default function HomeLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-[#fbf8f3] px-4 py-5" aria-label="Loading Tripanza">
      <div className="mx-auto h-14 max-w-[1240px] rounded-2xl bg-slate-200" />
      <div className="mx-auto mt-5 min-h-[620px] max-w-[1240px] rounded-[32px] bg-slate-300" />
      <div className="mx-auto mt-12 grid max-w-[1180px] gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-56 rounded-3xl bg-slate-200" />)}
      </div>
    </main>
  );
}
