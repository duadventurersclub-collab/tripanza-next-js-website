import Link from "next/link";
import { getAppTours } from "@/lib/wp";

export const dynamic = "force-dynamic";

interface ToursPageProps {
  searchParams: Promise<{ search?: string; destination?: string }>;
}

export default async function ToursPage({ searchParams }: ToursPageProps) {
  const { search, destination } = await searchParams;
  const searchQuery = search || destination || "";
  const { items: tours, total } = await getAppTours({ search: searchQuery, per_page: 30 });

  const filterChips = [
    { label: "All Trips", value: "" },
    { label: "Spiti Valley", value: "Spiti" },
    { label: "Himachal Pradesh", value: "Himachal" },
    { label: "Rajasthan Desert", value: "Jaisalmer" },
    { label: "Kasol & Parvati", value: "Kasol" },
    { label: "Weekend Escapes", value: "Weekend" },
  ];

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-emerald-500 selection:text-white">
      {/* Header Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent opacity-70" />
        
        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400 backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Departures & Community Trips
              </div>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white">
                Find your next <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">group story</span>.
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-300 sm:text-lg">
                Curated group itineraries with verified trip captains, cozy mountain stays, bonfire nights, and zero solo travel anxiety.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              ← Back to Home
            </Link>
          </div>

          {/* Search Bar */}
          <div className="mt-10 max-w-2xl">
            <form method="GET" action="/tours" className="relative flex items-center">
              <input
                type="text"
                name="search"
                defaultValue={searchQuery}
                placeholder="Search by destination (e.g. Spiti, Kasol, Manali)..."
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-4 pr-32 text-sm text-white placeholder-slate-400 backdrop-blur-xl transition focus:border-emerald-400 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
              />
              <button
                type="submit"
                className="absolute right-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25 active:scale-95"
              >
                Search
              </button>
            </form>
          </div>

          {/* Filter Pills */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">Popular:</span>
            {filterChips.map((chip) => {
              const active = searchQuery === chip.value;
              return (
                <Link
                  key={chip.label}
                  href={chip.value ? `/tours?search=${encodeURIComponent(chip.value)}` : "/tours"}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-emerald-400 text-slate-950 shadow-md shadow-emerald-400/20"
                      : "border border-white/15 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/10"
                  }`}
                >
                  {chip.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tours Grid Section */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {searchQuery ? `Search results for "${searchQuery}"` : "All Upcoming Trips"}
            </h2>
            <p className="text-sm text-slate-500">
              Showing {tours.length} of {total} verified community tours
            </p>
          </div>

          {searchQuery && (
            <Link
              href="/tours"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline"
            >
              Clear filters
            </Link>
          )}
        </div>

        {tours.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
              🏕️
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">No matching trips found</h3>
            <p className="mt-2 text-sm text-slate-600">
              Try searching with another keyword or explore our featured departures.
            </p>
            <Link
              href="/tours"
              className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Reset Search
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {tours.map((tour) => {
              const details = tour.details;
              const hasCashback = Boolean(details.cashback);

              return (
                <article
                  key={tour.id}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-slate-300 hover:shadow-xl"
                >
                  {/* Tour Image Container */}
                  <div className="relative h-60 w-full overflow-hidden bg-slate-100">
                    {tour.featured_image ? (
                      <img
                        src={tour.featured_image}
                        alt={tour.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                        No preview available
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      {details.is_trending && (
                        <span className="rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-950 shadow-sm">
                          🔥 Trending
                        </span>
                      )}
                      {details.seats_left && (
                        <span className="rounded-full bg-rose-500/90 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white backdrop-blur-md shadow-sm">
                          {details.seats_left}
                        </span>
                      )}
                    </div>

                    {/* Cashback Pill */}
                    {hasCashback && (
                      <div className="absolute right-4 top-4 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 shadow-sm">
                        💰 {details.cashback}
                      </div>
                    )}

                    {/* Destination & Duration Strip */}
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs font-semibold">
                      <span className="flex items-center gap-1.5 drop-shadow">
                        📍 {details.destination}
                      </span>
                      <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] backdrop-blur-md">
                        ⏱️ {details.duration.days}D / {details.duration.nights}N
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex flex-1 flex-col p-6">
                    {/* Origin & Rating */}
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-600">From {details.origin}</span>
                      <span className="flex items-center gap-1 font-bold text-slate-800">
                        ⭐ {details.rating.value.toFixed(1)} ({details.rating.count})
                      </span>
                    </div>

                    <h3 className="text-xl font-bold leading-snug text-slate-900 group-hover:text-emerald-700 transition">
                      <Link href={`/tours/${tour.slug}`}>{tour.title}</Link>
                    </h3>

                    <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-slate-600">
                      {tour.excerpt}
                    </p>

                    {/* Pricing Matrix Preview */}
                    <div className="mt-5 rounded-2xl bg-slate-50 p-3 text-xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1.5">
                        <span className="font-medium">Sharing Rates:</span>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">
                          Token: ₹2,000 only
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center font-bold text-slate-800">
                        <div className="rounded-lg bg-white p-1.5 shadow-2xs border border-slate-100">
                          <span className="block text-[10px] text-slate-400 uppercase font-medium">Quad</span>
                          <span>{details.pricing.quad?.display || tour.price}</span>
                        </div>
                        <div className="rounded-lg bg-white p-1.5 shadow-2xs border border-slate-100">
                          <span className="block text-[10px] text-slate-400 uppercase font-medium">Triple</span>
                          <span>{details.pricing.triple?.display || "-"}</span>
                        </div>
                        <div className="rounded-lg bg-white p-1.5 shadow-2xs border border-slate-100">
                          <span className="block text-[10px] text-slate-400 uppercase font-medium">Twin</span>
                          <span>{details.pricing.twin?.display || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Row */}
                    <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100">
                      <div>
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Starting From
                        </span>
                        <span className="text-xl font-extrabold text-slate-900">
                          {tour.price}
                        </span>
                      </div>

                      <Link
                        href={`/tours/${tour.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-600 active:scale-95 shadow-sm"
                      >
                        View Itinerary →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Community Assurance Banner */}
      <section className="border-t border-slate-200/80 bg-white py-16 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-xl">
                🛡️
              </div>
              <div>
                <h4 className="font-bold text-slate-900">100% Verified Trips</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Certified trip captains, vetted mountain stays, and sanitized vehicles.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xl">
                🎒
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Solo-Friendly</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Join alone, leave with a family. We match same-gender roommates seamlessly.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-xl">
                💳
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Split & Advance Pay</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Reserve your seat with small token amount. Pay the rest before departure.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-xl">
                💬
              </div>
              <div>
                <h4 className="font-bold text-slate-900">WhatsApp Community</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Direct group chat updates with captains and co-travelers prior to departure.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
