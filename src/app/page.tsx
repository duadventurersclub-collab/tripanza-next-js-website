import Link from "next/link";
import { getFeaturedTours, getSiteConfig } from "@/lib/wp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [site, tours] = await Promise.all([getSiteConfig(), getFeaturedTours()]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16">
        <nav className="flex items-center justify-between rounded-full border border-slate-200 bg-white/80 px-5 py-3 shadow-sm backdrop-blur-sm">
          <div>
            <p className="text-lg font-bold">{site.name}</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-700">
            <Link href="/">Home</Link>
            <Link href="/tours">Tours</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </nav>

        <div className="mt-16 grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Ultra-fast headless travel website
            </p>
            <h1 className="max-w-2xl text-5xl font-black tracking-tight text-slate-950 md:text-6xl">
              Discover unforgettable trips with a fast, modern frontend.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">
              {site.description || "High-converting experience pages powered by WordPress backend and a Next.js frontend."}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/tours" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
                Explore tours
              </Link>
              <Link href="/contact" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400">
                Contact us
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
            <div className="rounded-[1.5rem] bg-gradient-to-br from-emerald-500 via-cyan-500 to-sky-600 p-6 text-white">
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-100">Performance</p>
              <h2 className="mt-3 text-3xl font-bold">WordPress backend</h2>
              <p className="mt-4 text-sm text-emerald-50">Secure content and booking logic stay in WordPress. The Next.js front is optimized for speed and SEO.</p>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-slate-100 p-4">
                <div className="text-2xl font-black text-slate-900">1.6s</div>
                <div className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">LCP target</div>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4">
                <div className="text-2xl font-black text-slate-900">90+</div>
                <div className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">Lighthouse</div>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4">
                <div className="text-2xl font-black text-slate-900">SSR</div>
                <div className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">Edge-ready</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Featured</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">Popular destinations</h2>
          </div>
          <Link href="/tours" className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline">
            View all tours
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {tours.items.map((tour) => (
            <article key={tour.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              {tour.featured_image ? (
                <img src={tour.featured_image} alt={tour.title} className="h-56 w-full object-cover" />
              ) : (
                <div className="flex h-56 items-center justify-center bg-slate-100 text-sm text-slate-500">No image</div>
              )}
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold text-slate-900">{tour.title}</h3>
                  <span className="text-sm font-bold text-emerald-700">{tour.price || "Quote"}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{tour.excerpt || "Luxury travel experience designed for you."}</p>
                <Link href={`/tours/${tour.slug}`} className="mt-5 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                  View details
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
