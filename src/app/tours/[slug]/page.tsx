import { notFound } from "next/navigation";
import Link from "next/link";
import { getTourBySlug, type TourDetail } from "@/lib/wp";

export const dynamic = "force-dynamic";

function Money({ value }: { value: { display: string } | null }) {
  return <span>{value?.display || "See price"}</span>;
}

function ListSection({ title, items, tone = "blue" }: { title: string; items: string[]; tone?: "blue" | "lime" }) {
  if (!items.length) return null;
  return (
    <section className={`rounded-[26px] p-6 ${tone === "lime" ? "bg-[#f2f8d5]" : "bg-[#eef2ff]"}`}>
      <h2 className="text-2xl font-black tracking-[-0.04em]">{title}</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => <li key={item} className="flex gap-2 text-sm font-semibold leading-6 text-[#526075]"><span className="font-black text-[#3157d5]">{tone === "lime" ? "✓" : "•"}</span>{item}</li>)}
      </ul>
    </section>
  );
}

function TourContent({ tour }: { tour: TourDetail }) {
  const details = tour.details;
  const gallery = details.gallery.length ? details.gallery.slice(0, 5) : [{ url: tour.featured_image || "", alt: tour.title }];

  return (
    <main className="bg-[#f7f9fd] pb-20 text-[#151925]">
      <div className="mx-auto max-w-[1180px] px-4 pt-6"><Link href="/tours" className="text-xs font-black text-[#3157d5]">← Back to trips</Link></div>
      <section className="mx-auto mt-5 max-w-[1180px] px-4"><div className="grid gap-2 overflow-hidden rounded-[30px] bg-[#151923] md:h-[560px] md:grid-cols-[1.35fr_0.65fr] md:grid-rows-2">{gallery.map((image, index) => <img key={`${image.url}-${index}`} src={image.url} alt={image.alt || tour.title} className={`${index === 0 ? "md:row-span-2" : "hidden md:block"} h-[280px] w-full object-cover md:h-full`} />)}</div></section>
      <section className="mx-auto grid max-w-[1180px] gap-8 px-4 pt-8 lg:grid-cols-[1fr_340px]">
        <div><div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.1em] text-[#3157d5]"><span>{details.destination || "Tripanza journey"}</span>{details.rating.value > 0 && <span>★ {details.rating.value.toFixed(1)} ({details.rating.count})</span>}{details.partner.verified && <span className="text-[#708c00]">Verified partner</span>}</div><h1 className="mt-3 text-4xl font-black leading-none tracking-[-0.05em] md:text-6xl">{tour.title}</h1><p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[#697386]">{tour.excerpt}</p><div className="mt-6 flex flex-wrap gap-2">{[details.duration.days && `${details.duration.days} days`, details.duration.nights && `${details.duration.nights} nights`, details.capacity > 0 ? `${details.capacity} max` : "", details.origin && `From ${details.origin}`].filter((fact): fact is string => Boolean(fact)).map((fact) => <span key={fact} className="rounded-full border border-[#dce2ed] bg-white px-3 py-2 text-[10px] font-black text-[#566176]">{fact}</span>)}</div></div>
        <aside className="h-max rounded-[26px] bg-[#151923] p-5 text-white shadow-xl lg:sticky lg:top-6"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#d0e562]">Starting prices</p><div className="mt-4 grid gap-2">{([["Quad", details.pricing.quad], ["Triple", details.pricing.triple], ["Twin", details.pricing.twin]] as const).map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-3 text-sm"><span className="font-bold text-[#b7c0d2]">{label}</span><strong><Money value={value} /></strong></div>)}</div><Link href={`/booking?tour=${tour.id}`} className="mt-5 flex justify-center rounded-[14px] bg-[#d0e562] px-4 py-4 text-xs font-black text-[#263407]">Check availability</Link></aside>
      </section>

      <section className="mx-auto grid max-w-[1180px] gap-5 px-4 pt-10 md:grid-cols-2"><ListSection title="Moments worth travelling for" items={details.highlights} tone="lime" /><ListSection title="Included in your trip" items={details.included} /><ListSection title="Plan separately" items={details.excluded} tone="lime" /></section>

      {details.departures.length > 0 && <section className="mx-auto max-w-[1180px] px-4 pt-10"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#3157d5]">Live availability</p><h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">Upcoming batches</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{details.departures.map((departure) => <div key={departure.date} className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${departure.promoted ? "border-[#d0e562] bg-[#f2f8d5]" : "border-[#dce2ed] bg-white"}`}><div><strong className="block text-sm font-black">{departure.date}</strong>{departure.check_out && <small className="mt-1 block text-xs font-semibold text-[#697386]">Returns {departure.check_out}</small>}{departure.benefit && <small className="mt-1 block text-xs font-bold text-[#708c00]">{departure.benefit}</small>}</div><span className="rounded-full bg-[#eef2ff] px-3 py-2 text-[9px] font-black text-[#3157d5]">{departure.badge || departure.status}</span></div>)}</div></section>}

      {details.itinerary.length > 0 && <section className="mx-auto max-w-[1180px] px-4 pt-10"><div className="rounded-[30px] bg-[#151923] p-5 text-white md:p-8"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#d0e562]">Your trip story</p><h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">Every day, thoughtfully planned.</h2><div className="mt-7 grid gap-4">{details.itinerary.map((day) => <article key={day.day} className="overflow-hidden rounded-[22px] bg-white text-[#151925] md:grid md:grid-cols-[220px_1fr]">{day.image_url && <img src={day.image_url} alt={day.title} className="h-48 w-full object-cover md:h-full" />}<div className="p-5"><span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#3157d5]">Day {String(day.day).padStart(2, "0")}</span><h3 className="mt-2 text-xl font-black">{day.title}</h3><div className="prose prose-sm mt-3 max-w-none text-[#697386]" dangerouslySetInnerHTML={{ __html: day.description }} /></div></article>)}</div></div></section>}

      {details.stays.length > 0 && <section className="mx-auto max-w-[1180px] px-4 pt-10"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#3157d5]">Rest well</p><h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">Your stay, sorted.</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{details.stays.map((stay) => <article key={stay.title} className="overflow-hidden rounded-[24px] border border-[#dce2ed] bg-white">{stay.images[0] && <img src={stay.images[0]} alt={stay.title} className="h-56 w-full object-cover" />}<div className="p-5"><h3 className="text-xl font-black">{stay.title}</h3><p className="mt-2 text-sm font-semibold text-[#697386]">{[stay.location, stay.type].filter(Boolean).join(" • ")}</p><div className="prose prose-sm mt-3 max-w-none text-[#697386]" dangerouslySetInnerHTML={{ __html: stay.description }} />{stay.amenities.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{stay.amenities.map((amenity) => <span key={amenity} className="rounded-full bg-[#f2f8d5] px-3 py-2 text-[9px] font-black text-[#52620e]">{amenity}</span>)}</div>}</div></article>)}</div></section>}

      {details.faqs.length > 0 && <section className="mx-auto max-w-[900px] px-4 pt-10"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#3157d5]">Before you go</p><h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">Good to know.</h2><div className="mt-5 grid gap-2">{details.faqs.map((faq) => <details key={faq.question} className="rounded-2xl border border-[#dce2ed] bg-white p-5"><summary className="cursor-pointer text-sm font-black">{faq.question}</summary><div className="prose prose-sm mt-3 max-w-none text-[#697386]" dangerouslySetInnerHTML={{ __html: faq.answer }} /></details>)}</div></section>}

      <section className="mx-auto flex max-w-[1180px] items-center gap-4 px-4 pt-10"><div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-[#eef2ff]">{details.partner.logo_url ? <img src={details.partner.logo_url} alt="" className="h-full w-full object-cover" /> : "✦"}</div><div><p className="text-xs font-black">{details.partner.name || "Tripanza partner"}</p><p className="mt-1 text-[10px] font-semibold text-[#697386]">{details.partner.trip_count} trips created {details.partner.rating > 0 ? `• ${details.partner.rating.toFixed(1)} partner rating` : ""}</p></div></section>
    </main>
  );
}

export default async function TourDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tour = await getTourBySlug(slug).catch(() => null);
  if (!tour) notFound();
  return <TourContent tour={tour} />;
}
