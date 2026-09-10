import Link from "next/link";
import { getFeaturedTours } from "@/lib/wp";

export const dynamic = "force-dynamic";

export default async function ToursPage() {
  const data = await getFeaturedTours();

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Explore</p>
          <h1 className="mt-2 text-4xl font-bold text-slate-900">Tours & experiences</h1>
        </div>
        <Link href="/" className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline">
          Back home
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {data.items.map((tour) => (
          <article key={tour.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            {tour.featured_image ? (
              <img src={tour.featured_image} alt={tour.title} className="h-56 w-full object-cover" />
            ) : (
              <div className="flex h-56 items-center justify-center bg-slate-100 text-sm text-slate-500">No image</div>
            )}

            <div className="p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">Featured</span>
                <span className="text-lg font-bold text-slate-900">{tour.price || "From quote"}</span>
              </div>

              <h2 className="text-xl font-semibold text-slate-900">{tour.title}</h2>
              <p className="mt-3 line-clamp-3 text-sm text-slate-600">{tour.excerpt || "Discover this amazing experience with Tripanza."}</p>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{tour.currency}</span>
                <Link href={`/tours/${tour.slug}`} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                  View tour
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
