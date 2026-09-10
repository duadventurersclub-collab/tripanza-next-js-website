import { notFound } from "next/navigation";
import Link from "next/link";
import { getTourBySlug } from "@/lib/wp";

export const dynamic = "force-dynamic";

export default async function TourDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tour = await getTourBySlug(slug).catch(() => null);

  if (!tour) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link href="/tours" className="mb-6 inline-block text-sm font-medium text-slate-700 underline-offset-4 hover:underline">
        ← Back to tours
      </Link>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        {tour.featured_image ? (
          <img src={tour.featured_image} alt={tour.title} className="h-[420px] w-full object-cover" />
        ) : (
          <div className="flex h-[420px] items-center justify-center bg-slate-100 text-slate-500">Tour image</div>
        )}

        <div className="grid gap-8 p-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Tour detail</p>
            <h1 className="mt-3 text-4xl font-black text-slate-900">{tour.title}</h1>
            <div className="mt-6 prose max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: tour.content || tour.excerpt || "" }} />
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">From</p>
            <div className="mt-2 text-3xl font-black text-slate-900">{tour.price || "Quote"}</div>
            <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{tour.currency}</p>
              <p className="mt-2">Instant booking available</p>
            </div>
            <Link href="/booking" className="mt-6 inline-flex w-full justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
              Book now
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
