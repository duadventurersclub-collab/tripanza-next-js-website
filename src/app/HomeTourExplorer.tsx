"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { TourSummary } from "@/lib/wp";

const fallbackImage =
  "https://tripanza.com/wp-content/uploads/2022/09/WhatsApp-Image-2022-09-16-at-2.04.56-AM.jpeg";

export default function HomeTourExplorer({ tours }: { tours: TourSummary[] }) {
  const [activeFilter, setActiveFilter] = useState("All trips");
  const [saved, setSaved] = useState<number[]>([]);

  const filters = useMemo(
    () => [
      "All trips",
      ...Array.from(new Set(tours.map((tour) => tour.title.split(" ").at(-1) || "Trips"))).slice(0, 3),
    ],
    [tours],
  );
  const visibleTours = tours.filter(
    (tour) => activeFilter === "All trips" || tour.title.endsWith(activeFilter),
  );

  function toggleSaved(id: number) {
    setSaved((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <section id="trips" className="mx-auto max-w-[1180px] px-4 py-16">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#3157d5]">
            Currently passing the vibe check
          </p>
          <h2 className="mt-2 max-w-2xl text-4xl font-black leading-none tracking-[-0.05em] md:text-5xl">
            Trips worth sending to the group chat.
          </h2>
        </div>
        <Link href="/tours" className="text-xs font-black text-[#3157d5]">
          Explore every trip -&gt;
        </Link>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-black ${
              activeFilter === filter
                ? "border-[#3157d5] bg-[#3157d5] text-white"
                : "border-[#dce2ed] bg-white text-[#5e6879]"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleTours.slice(0, 6).map((tour) => {
          const isSaved = saved.includes(tour.id);
          return (
            <article
              key={tour.id}
              className="grid min-h-[226px] grid-cols-[clamp(125px,30%,165px)_minmax(0,1fr)] overflow-hidden rounded-[21px] border border-[#dce2ed] bg-white shadow-[0_10px_25px_rgba(28,41,77,0.05)]"
            >
              <Link href={`/tours/${tour.slug}`} className="relative min-h-[226px] bg-[#eef1f5]">
                <Image
                  src={tour.featured_image || fallbackImage}
                  alt={tour.title}
                  fill
                  sizes="(max-width: 768px) 40vw, 165px"
                  className="object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />
              </Link>
              <div className="flex min-w-0 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/tours/${tour.slug}`}
                    className="line-clamp-2 text-lg font-black leading-tight"
                  >
                    {tour.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleSaved(tour.id)}
                    aria-label={isSaved ? "Remove saved trip" : "Save trip"}
                    className={`text-xl ${isSaved ? "text-[#e84d89]" : "text-[#8994a5]"}`}
                  >
                    {isSaved ? "♥" : "♡"}
                  </button>
                </div>
                <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-[#697386]">
                  {tour.excerpt || "A real group trip, designed around people and stories."}
                </p>
                <div className="mt-auto border-t border-[#edf0f5] pt-3">
                  <small className="block text-[9px] font-bold uppercase tracking-wide text-[#747e90]">
                    Starts from
                  </small>
                  <strong className="text-base font-black text-[#173fb9]">
                    {tour.price || "See price"}
                  </strong>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {visibleTours.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-[#cdd6e6] bg-white p-8 text-center text-sm font-semibold text-[#697386]">
          No trip matches that yet. Try another destination.
        </p>
      )}
    </section>
  );
}
