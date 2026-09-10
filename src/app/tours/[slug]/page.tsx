import { notFound } from "next/navigation";
import Link from "next/link";
import { getTourBySlug, getAppTourAvailability, type TourDetail, type TourAvailabilityBatch } from "@/lib/wp";

export const dynamic = "force-dynamic";

interface TourDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TourDetailPage({ params }: TourDetailPageProps) {
  const { slug } = await params;
  const tour = await getTourBySlug(slug);

  if (!tour) {
    notFound();
  }

  // Retrieve live departure batches if available
  let availabilityBatches: TourAvailabilityBatch[] = [];
  try {
    availabilityBatches = await getAppTourAvailability(tour.id);
  } catch {
    availabilityBatches = [];
  }

  const details = tour.details;
  const gallery = details.gallery.length > 0
    ? details.gallery
    : [{ url: tour.featured_image || "https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?q=80&w=1200", alt: tour.title }];

  const partner = details.partner;
  const pricing = details.pricing;

  // WhatsApp share inquiry link with prefilled tour info
  const whatsappMsg = encodeURIComponent(
    `Hey Tripanza Team! I am interested in the ${tour.title} (${details.duration.days}D/${details.duration.nights}N). Could you please share the next departure batch dates and availability?`
  );
  const whatsappInquiryUrl = `https://wa.me/919999999999?text=${whatsappMsg}`;

  return (
    <main className="min-h-screen bg-[#fafbfc] text-slate-900 selection:bg-emerald-500 selection:text-white pb-24">
      {/* Breadcrumb Navigation */}
      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Link href="/" className="hover:text-slate-900">Home</Link>
            <span>/</span>
            <Link href="/tours" className="hover:text-slate-900">Tours</Link>
            <span>/</span>
            <span className="truncate max-w-[200px] sm:max-w-md text-slate-800 font-semibold">{tour.title}</span>
          </nav>

          <Link
            href="/tours"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700"
          >
            ← Back to all trips
          </Link>
        </div>
      </div>

      {/* Tour Hero Header */}
      <section className="mx-auto max-w-7xl px-6 pt-8">
        {/* Title & Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
            📍 {details.destination}
          </span>
          {details.is_trending && (
            <span className="rounded-full bg-amber-400 px-3 py-1 text-slate-950 font-extrabold">
              🔥 Trending Trip
            </span>
          )}
          {details.cashback && (
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-slate-950 font-extrabold">
              💰 {details.cashback}
            </span>
          )}
          {details.seats_left && (
            <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700 font-extrabold">
              ⚡ {details.seats_left}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-800">
            ⭐ {details.rating.value.toFixed(1)} ({details.rating.count} reviews)
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
          {tour.title}
        </h1>

        <p className="mt-3 max-w-3xl text-base text-slate-600 sm:text-lg leading-relaxed">
          {tour.excerpt}
        </p>

        {/* Gallery Grid */}
        <div className="mt-6 grid gap-3 overflow-hidden rounded-3xl md:h-[480px] md:grid-cols-4 md:grid-rows-2">
          {/* Main Hero Photo */}
          <div className="relative md:col-span-2 md:row-span-2 h-72 md:h-full bg-slate-200 overflow-hidden">
            <img
              src={gallery[0]?.url}
              alt={gallery[0]?.alt || tour.title}
              className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute bottom-4 left-4 rounded-xl bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
              Primary Departure: {details.origin}
            </div>
          </div>

          {/* Additional Photos */}
          {gallery.slice(1, 5).map((img, i) => (
            <div key={i} className="relative hidden h-full w-full overflow-hidden bg-slate-200 md:block">
              <img
                src={img.url}
                alt={img.alt || `Photo ${i + 2}`}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
              />
            </div>
          ))}
        </div>

        {/* Quick Stats Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 text-lg">
              ⏱️
            </div>
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase">Duration</span>
              <strong className="text-sm font-bold text-slate-800">{details.duration.days} Days / {details.duration.nights} Nights</strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg">
              🚌
            </div>
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase">Pick-up Location</span>
              <strong className="text-sm font-bold text-slate-800">{details.origin}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 text-lg">
              👥
            </div>
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase">Group Size</span>
              <strong className="text-sm font-bold text-slate-800">Up to {details.capacity} People</strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 text-lg">
              🛡️
            </div>
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase">Trip Security</span>
              <strong className="text-sm font-bold text-slate-800">Verified Captains</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Layout (Left Details, Right Sticky Booking) */}
      <div className="mx-auto mt-10 max-w-7xl px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          {/* LEFT CONTENT COLUMN */}
          <div className="space-y-12">
            {/* Highlights Section */}
            {details.highlights.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600">
                  <span className="text-xl">✨</span>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Moments You Will Remember</h2>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {details.highlights.map((highlight, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                        ✓
                      </span>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed">{highlight}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Day-by-Day Itinerary */}
            {details.itinerary.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600">
                      <span>🗺️ Day-by-Day Plan</span>
                    </div>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                      The Complete Journey Itinerary
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    {details.itinerary.length} Days Planned
                  </span>
                </div>

                <div className="mt-8 relative border-l-2 border-emerald-100 ml-4 space-y-8">
                  {details.itinerary.map((day) => (
                    <article key={day.day} className="relative pl-6 sm:pl-8 group">
                      {/* Day Number Badge on Timeline */}
                      <div className="absolute -left-[17px] top-0 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-xs font-extrabold text-white shadow-md shadow-emerald-500/30">
                        D{day.day}
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 transition hover:bg-white hover:shadow-md hover:border-slate-200">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                          Day {day.day}
                        </span>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          {day.title}
                        </h3>

                        {day.image_url && (
                          <div className="mt-3 h-48 w-full overflow-hidden rounded-xl">
                            <img
                              src={day.image_url}
                              alt={day.title}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>
                        )}

                        <div
                          className="mt-3 text-sm leading-relaxed text-slate-600"
                          dangerouslySetInnerHTML={{ __html: day.description }}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Accommodations Section */}
            {details.stays.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600">
                  <span>🏡 Where You Will Stay</span>
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Curated Stays & Homestays
                </h2>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  {details.stays.map((stay, idx) => (
                    <div key={idx} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 flex flex-col">
                      {stay.images[0] && (
                        <div className="h-44 w-full overflow-hidden">
                          <img
                            src={stay.images[0]}
                            alt={stay.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-5 flex flex-col flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {stay.type || "Resort / Camp"} • {stay.location || details.destination}
                        </span>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">{stay.title}</h3>
                        <p className="mt-2 text-xs text-slate-600 leading-relaxed flex-1">{stay.description}</p>

                        {stay.amenities.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-slate-200/60">
                            {stay.amenities.map((amenity, aIdx) => (
                              <span
                                key={aIdx}
                                className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                              >
                                {amenity}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Inclusions & Exclusions */}
            <section className="grid gap-6 md:grid-cols-2">
              {/* Included */}
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-6 sm:p-8">
                <div className="flex items-center gap-2 text-emerald-800">
                  <span className="text-xl">✅</span>
                  <h3 className="text-xl font-bold">What is Included</h3>
                </div>
                <ul className="mt-5 space-y-3">
                  {details.included.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm font-medium text-slate-800">
                      <span className="font-bold text-emerald-600 shrink-0">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Excluded */}
              <div className="rounded-3xl border border-rose-200 bg-rose-50/40 p-6 sm:p-8">
                <div className="flex items-center gap-2 text-rose-800">
                  <span className="text-xl">❌</span>
                  <h3 className="text-xl font-bold">What is Not Included</h3>
                </div>
                <ul className="mt-5 space-y-3">
                  {details.excluded.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm font-medium text-slate-800">
                      <span className="font-bold text-rose-500 shrink-0">✕</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Upcoming Batches & Live Availability */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600">
                    <span>📅 Live Departure Batches</span>
                  </div>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                    Select Your Travel Dates
                  </h2>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {availabilityBatches.length > 0 ? (
                  availabilityBatches.map((batch, bIdx) => (
                    <div
                      key={bIdx}
                      className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                        batch.status.toLowerCase().includes("fast") || batch.promoted
                          ? "border-emerald-300 bg-emerald-50/50 shadow-xs"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <strong className="text-sm font-bold text-slate-900">
                            {batch.check_in_formatted || "Departure"}
                          </strong>
                          {batch.check_out_formatted && (
                            <span className="block text-xs text-slate-500">
                              Return: {batch.check_out_formatted}
                            </span>
                          )}
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          {batch.status || "Available"}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-xs font-bold text-slate-900">
                          {batch.adult_price ? `₹${batch.adult_price}` : tour.price}
                        </span>
                        <Link
                          href={`/booking?tour=${tour.id}&date=${batch.check_in}`}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 transition"
                        >
                          Select Date
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  details.departures.map((dep, dIdx) => (
                    <div
                      key={dIdx}
                      className={`flex items-center justify-between rounded-2xl border p-4 ${
                        dep.promoted ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div>
                        <strong className="text-sm font-bold text-slate-900">{dep.date}</strong>
                        <span className="block text-xs text-slate-500">Returns: {dep.check_out}</span>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                        {dep.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* FAQs Accordion */}
            {details.faqs.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600">
                  <span>❓ Have Questions?</span>
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Frequently Asked Questions
                </h2>

                <div className="mt-6 divide-y divide-slate-100">
                  {details.faqs.map((faq, idx) => (
                    <details key={idx} className="group py-4">
                      <summary className="flex cursor-pointer items-center justify-between text-sm font-bold text-slate-900 hover:text-emerald-700">
                        <span>{faq.question}</span>
                        <span className="ml-4 transition-transform group-open:rotate-180 text-emerald-600 font-bold">
                          ▼
                        </span>
                      </summary>
                      <div
                        className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: faq.answer }}
                      />
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Host / Partner Bio */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 text-2xl font-bold text-emerald-800">
                {partner.logo_url ? (
                  <img src={partner.logo_url} alt={partner.name} className="h-full w-full object-cover" />
                ) : (
                  "⛰️"
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{partner.name}</h3>
                  {partner.verified && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                      ✓ Verified Organizer
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {partner.trip_count} community trips hosted • ⭐ {partner.rating.toFixed(1)} host rating
                </p>
              </div>

              {partner.instagram_url && (
                <a
                  href={partner.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition"
                >
                  Instagram ↗
                </a>
              )}
            </section>
          </div>

          {/* RIGHT STICKY BOOKING CARD */}
          <aside className="lg:sticky lg:top-8 h-max space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Starting Price
                </span>
                <div className="text-right">
                  <span className="text-3xl font-extrabold text-slate-950">{tour.price}</span>
                  <span className="block text-[10px] text-slate-500 font-medium">per person + 5% GST</span>
                </div>
              </div>

              {/* Deposit Banner */}
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-bold">
                  <span>💳</span>
                  <span>Book with ₹2,000 Advance Token</span>
                </div>
                <p className="mt-1 text-[11px] text-emerald-800/90 leading-normal">
                  Reserve your confirmed seat now. Balance amount payable prior to departure.
                </p>
              </div>

              {/* Sharing Price Breakdown */}
              <div className="mt-5 space-y-2.5">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Room Sharing Options
                </label>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">Quad Sharing</span>
                      <small className="text-[10px] text-slate-500">4 People in 1 Room</small>
                    </div>
                    <strong className="text-slate-900 font-bold">
                      {pricing.quad?.display || tour.price}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">Triple Sharing</span>
                      <small className="text-[10px] text-slate-500">3 People in 1 Room</small>
                    </div>
                    <strong className="text-slate-900 font-bold">
                      {pricing.triple?.display || "-"}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">Twin / Couple Sharing</span>
                      <small className="text-[10px] text-slate-500">2 People / Private Room</small>
                    </div>
                    <strong className="text-slate-900 font-bold">
                      {pricing.twin?.display || "-"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 space-y-3">
                <Link
                  href={`/booking?tour=${tour.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25 active:scale-98"
                >
                  Book My Seat Now →
                </Link>

                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50 active:scale-98"
                >
                  <span className="text-emerald-500 font-bold text-sm">💬</span>
                  Chat with Trip Coordinator on WhatsApp
                </a>
              </div>

              {/* Assurances */}
              <div className="mt-5 space-y-1.5 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
                <p className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  Instant booking confirmation receipt
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  Dedicated WhatsApp group with captains
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  Same-gender roommate matching for solo travelers
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-md lg:hidden shadow-2xl">
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-400">Starting from</span>
          <span className="text-xl font-extrabold text-slate-950">{tour.price}</span>
        </div>

        <div className="flex gap-2">
          <a
            href={whatsappInquiryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-3 text-emerald-600 text-lg shadow-sm"
            aria-label="WhatsApp Inquiry"
          >
            💬
          </a>

          <Link
            href={`/booking?tour=${tour.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-extrabold text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95"
          >
            Book Seat (₹2k) →
          </Link>
        </div>
      </div>
    </main>
  );
}
