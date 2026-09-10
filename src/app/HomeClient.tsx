"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TourSummary } from "@/lib/wp";

const logoUrl = "https://tripanza.com/wp-content/uploads/2026/04/Tripanza-Logo-3.png";
const gallery = [
  "https://tripanza.com/wp-content/uploads/2022/09/WhatsApp-Image-2022-09-16-at-2.04.56-AM.jpeg",
  "https://tripanza.com/wp-content/uploads/2021/06/WhatsApp-Image-2021-07-12-at-2.28.22-AM-15-e1662666832961.jpeg",
];

export default function HomeClient({ tours, siteName }: { tours: TourSummary[]; siteName: string }) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All trips");
  const [saved, setSaved] = useState<number[]>([]);

  const filters = useMemo(() => ["All trips", ...Array.from(new Set(tours.map((tour) => tour.title.split(" ").at(-1) || "Trips"))).slice(0, 3)], [tours]);
  const visibleTours = tours.filter((tour) => {
    const matchesQuery = `${tour.title} ${tour.excerpt}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = activeFilter === "All trips" || tour.title.endsWith(activeFilter);
    return matchesQuery && matchesFilter;
  });

  function toggleSaved(id: number) {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main className="overflow-hidden bg-[#fbf8f3] text-[#151925]">
      <nav className="sticky top-0 z-30 border-b border-[#1f2b460f] bg-white/85 px-4 py-3 shadow-[0_8px_28px_rgba(27,40,72,0.05)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-12 max-w-[1180px] items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-[19px] font-black tracking-[-0.6px]">
            <img src={logoUrl} alt="Tripanza" className="h-10 w-10 rounded-xl object-contain" />
            {siteName || "Tripanza"}
          </Link>
          <div className="ml-auto hidden items-center gap-7 text-[11px] font-extrabold text-[#586275] md:flex">
            <a href="#trips" className="hover:text-[#3157d5]">Explore trips</a>
            <a href="#why-tripanza" className="hover:text-[#3157d5]">Why Tripanza</a>
            <Link href="/account" className="hover:text-[#3157d5]">My account</Link>
          </div>
          <Link href="/login" className="rounded-[13px] bg-[#d0e562] px-4 py-3 text-[10px] font-black text-[#263407]">Find my trip</Link>
        </div>
      </nav>

      <header className="mx-auto grid max-w-[1180px] items-center gap-10 px-4 pb-16 pt-10 lg:grid-cols-[0.94fr_1.06fr] lg:gap-14 lg:pt-14">
        <div>
          <span className="inline-flex rounded-full border border-[#dbe3ff] bg-[#eef2ff] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-[#2447bd]">Community trips for 18-28</span>
          <h1 className="mt-5 max-w-[650px] text-[clamp(3.4rem,7vw,5.4rem)] font-black leading-[0.93] tracking-[-0.06em]">Your next story won&apos;t fit in the <em className="not-italic text-[#3157d5]">group chat.</em></h1>
          <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#677285]">Join young travellers, explore somewhere unreal and come back with a camera roll full of people who stopped feeling like strangers.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#dbe3ff] bg-[#eef2ff] px-3 py-2 text-[9px] font-black text-[#2447bd]">Community trips</span>
            <span className="rounded-full border border-[#d8e891] bg-[#f2f8d5] px-3 py-2 text-[9px] font-black text-[#354900]">18-28 only</span>
            <span className="rounded-full border border-[#ffd0df] bg-[#fff0f6] px-3 py-2 text-[9px] font-black text-[#a3265d]">Women-friendly</span>
          </div>
          <div className="mt-6 flex max-w-[610px] overflow-hidden rounded-2xl border border-[#dce2ed] bg-white shadow-[0_12px_30px_rgba(28,41,77,0.08)]">
            <span className="grid w-12 shrink-0 place-items-center text-xl text-[#3157d5]">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Where do you want to disappear?" className="min-w-0 flex-1 bg-transparent px-1 text-sm font-semibold outline-none placeholder:text-[#8a94a4]" />
            <a href="#trips" className="m-1 rounded-xl bg-[#3157d5] px-4 py-3 text-[10px] font-black text-white">Show me trips</a>
          </div>
        </div>

        <div className="relative min-h-[410px] lg:min-h-[510px]">
          <div className="absolute inset-0 right-10 overflow-hidden rounded-[32px] bg-[#171c29] shadow-[0_30px_70px_rgba(25,39,74,0.17)] lg:-rotate-2">
            <img src={tours[0]?.featured_image || gallery[0]} alt="Tripanza group trip" className="h-full w-full object-cover saturate-[0.9]" fetchPriority="high" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#060910dd] to-transparent px-6 pb-7 pt-24 text-white">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#d0e562]">The group chat left home</p>
              <p className="mt-2 max-w-sm text-2xl font-black leading-tight">This is what “we should plan a trip” looks like.</p>
            </div>
          </div>
          <div className="absolute right-0 top-12 w-40 rotate-3 rounded-[22px] border border-white/70 bg-white/90 p-2 shadow-[0_20px_45px_rgba(27,40,78,0.15)] backdrop-blur-xl">
            <img src={tours[1]?.featured_image || gallery[1]} alt="Tripanza destination" className="h-40 w-full rounded-[15px] object-cover" />
            <p className="px-1 pb-1 pt-2 text-[11px] font-extrabold">One trip away</p>
          </div>
          <span className="absolute bottom-2 right-4 rounded-[15px] bg-[#d0e562] px-3 py-3 text-[10px] font-black text-[#27340b] shadow-lg">Real people. Real plans.</span>
        </div>
      </header>

      <section className="border-y border-[#e1e6ef] bg-white">
        <div className="mx-auto grid max-w-[1180px] divide-y divide-[#e1e6ef] px-4 md:grid-cols-3 md:divide-x md:divide-y-0">
          {[['2016', 'Exploring since', 'Building youth travel, one group at a time.'], ['50K+', 'Happy travellers', 'People who turned plans into stories.'], ['1000+', 'Trips created', 'Designed around people, not only destinations.']].map(([metric, title, copy]) => (
            <div key={metric} className="flex items-center gap-3 px-0 py-4 md:px-6 md:py-6 first:pl-0 last:pr-0">
              <strong className="grid h-11 min-w-[66px] place-items-center rounded-[14px] bg-[#3157d5] px-2 text-[15px] text-white">{metric}</strong>
              <span><b className="block text-xs font-black">{title}</b><small className="mt-1 block text-[10px] font-semibold text-[#747e90]">{copy}</small></span>
            </div>
          ))}
        </div>
      </section>

      <section id="trips" className="mx-auto max-w-[1180px] px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#3157d5]">Currently passing the vibe check</p><h2 className="mt-2 max-w-2xl text-4xl font-black leading-none tracking-[-0.05em] md:text-5xl">Trips worth sending to the group chat.</h2></div>
          <Link href="/tours" className="text-xs font-black text-[#3157d5]">Explore every trip -&gt;</Link>
        </div>
        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {filters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-black ${activeFilter === filter ? "border-[#3157d5] bg-[#3157d5] text-white" : "border-[#dce2ed] bg-white text-[#5e6879]"}`}>{filter}</button>)}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleTours.slice(0, 6).map((tour) => {
            const isSaved = saved.includes(tour.id);
            return <article key={tour.id} className="grid min-h-[226px] grid-cols-[clamp(125px,30%,165px)_minmax(0,1fr)] overflow-hidden rounded-[21px] border border-[#dce2ed] bg-white shadow-[0_10px_25px_rgba(28,41,77,0.05)]">
              <Link href={`/tours/${tour.slug}`} className="relative min-h-[226px] bg-[#eef1f5]"><img src={tour.featured_image || gallery[0]} alt={tour.title} className="h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" /></Link>
              <div className="flex min-w-0 flex-col p-4"><div className="flex items-start justify-between gap-2"><Link href={`/tours/${tour.slug}`} className="line-clamp-2 text-lg font-black leading-tight">{tour.title}</Link><button type="button" onClick={() => toggleSaved(tour.id)} aria-label={isSaved ? "Remove saved trip" : "Save trip"} className={`text-xl ${isSaved ? "text-[#e84d89]" : "text-[#8994a5]"}`}>{isSaved ? "♥" : "♡"}</button></div><p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-[#697386]">{tour.excerpt || "A real group trip, designed around people and stories."}</p><div className="mt-auto border-t border-[#edf0f5] pt-3"><small className="block text-[9px] font-bold uppercase tracking-wide text-[#747e90]">Starts from</small><strong className="text-base font-black text-[#173fb9]">{tour.price || "See price"}</strong></div></div>
            </article>;
          })}
        </div>
        {visibleTours.length === 0 && <p className="mt-8 rounded-2xl border border-dashed border-[#cdd6e6] bg-white p-8 text-center text-sm font-semibold text-[#697386]">No trip matches that yet. Try another destination.</p>}
      </section>

      <section id="people-planning" className="bg-[#f6f8fc] px-4 py-16">
        <div className="mx-auto max-w-[1180px]"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#3157d5]">Dates people are planning around</p><h2 className="mt-2 max-w-2xl text-4xl font-black leading-none tracking-[-0.05em] md:text-5xl">Pick a date. We&apos;ll bring the people.</h2><div className="mt-7 flex gap-3 overflow-x-auto pb-3">{tours.slice(0, 6).map((tour, index) => <Link key={tour.id} href={`/tours/${tour.slug}`} className="grid min-w-[280px] grid-cols-[72px_1fr] overflow-hidden rounded-[22px] border border-[#dce2ed] bg-white shadow-sm"><span className={`grid place-items-center px-2 text-center text-white ${index % 3 === 1 ? "bg-[#d0e562] text-[#27340b]" : "bg-[#3157d5]"}`}><b className="text-2xl font-black">{String(index + 12).padStart(2, "0")}</b><small className="text-[9px] font-black uppercase">Jun</small></span><span className="flex min-w-0 flex-col justify-center p-4"><b className="truncate text-sm font-black">{tour.title}</b><span className="mt-2 text-[9px] font-bold text-[#697386]">{tour.excerpt || "Seats available"}</span><strong className="mt-3 text-sm font-black text-[#173fb9]">{tour.price || "See price"}</strong></span></Link>)}</div></div>
      </section>

      <section id="deal-drops" className="bg-[#111624] px-4 py-16 text-white">
        <div className="mx-auto max-w-[1180px]"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#d0e562]">No boring offers</p><h2 className="mt-2 max-w-2xl text-4xl font-black leading-none tracking-[-0.05em] md:text-5xl">Good trips. Better reasons to book now.</h2><div className="mt-7 flex gap-4 overflow-x-auto pb-3">{tours.slice(0, 6).map((tour, index) => <Link key={tour.id} href={`/tours/${tour.slug}`} className={`relative min-h-[330px] min-w-[300px] overflow-hidden rounded-[30px] p-5 ${["bg-[#d0e562] text-[#172008]", "bg-[#3157d5]", "bg-[#ff6554]", "bg-[#cdb8ff] text-[#251740]"][index % 4]}`}><img src={tour.featured_image || gallery[index % gallery.length]} alt="" className="absolute right-4 top-5 h-40 w-32 rotate-3 rounded-[55px_18px_55px_55px] border-4 border-white/70 object-cover shadow-xl" /><span className="relative inline-flex rounded-lg bg-white/75 px-2 py-2 text-[9px] font-black">{index % 2 ? "LIMITED DROP" : "TRIP DEAL"}</span><h3 className="relative mt-20 max-w-[170px] text-2xl font-black leading-tight">{tour.title}</h3><p className="absolute bottom-5 left-5 text-xs font-black">From {tour.price || "your next story"}</p></Link>)}</div></div>
      </section>

      <section id="destinations" className="bg-white px-4 py-16"><div className="mx-auto max-w-[1180px]"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#3157d5]">Destination storefront</p><h2 className="mt-2 max-w-2xl text-4xl font-black leading-none tracking-[-0.05em] md:text-5xl">Somewhere unreal is closer than you think.</h2><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tours.slice(0, 5).map((tour, index) => <Link key={tour.id} href={`/tours/${tour.slug}`} className={`relative h-[260px] overflow-hidden rounded-[22px] ${index === 0 ? "lg:row-span-2 lg:h-[533px]" : ""}`}><img src={tour.featured_image || gallery[index % gallery.length]} alt={tour.title} className="h-full w-full object-cover transition duration-500 hover:scale-105" /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-20 text-white"><b className="block text-lg font-black">{tour.title}</b><small className="mt-1 block text-[9px] font-bold text-[#d0e562]">{tour.price || "Explore this trip"}</small></span></Link>)}</div></div></section>

      <section id="tripanza-camera-roll" className="overflow-hidden bg-[#fffaf4] px-4 py-16"><div className="mx-auto max-w-[1180px]"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#3157d5]">The camera roll</p><h2 className="mt-2 text-4xl font-black leading-none tracking-[-0.05em] md:text-5xl">Proof that plans can become stories.</h2><div className="mt-7 flex gap-3 overflow-x-auto pb-3">{[...tours, ...tours].slice(0, 12).map((tour, index) => <Link key={`${tour.id}-${index}`} href={`/tours/${tour.slug}`} className={`relative h-[190px] shrink-0 overflow-hidden rounded-[21px] ${index % 4 === 1 ? "w-[300px]" : index % 4 === 2 ? "w-[235px]" : "w-[190px]"}`}><img src={tour.featured_image || gallery[index % gallery.length]} alt={tour.title} className="h-full w-full object-cover" /><span className="absolute inset-x-3 bottom-3 truncate text-[9px] font-black text-white drop-shadow-lg">{tour.title}</span></Link>)}</div></div></section>

      <section id="quick-picks" className="bg-[#fffaf4] px-4 py-16"><div className="mx-auto max-w-[1180px]"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#3157d5]">Youth-first shortcuts</p><h2 className="mt-2 max-w-2xl text-4xl font-black leading-none tracking-[-0.05em] md:text-5xl">A weekend away or a proper escape.</h2><div className="mt-7 grid gap-4 md:grid-cols-2">{["Under ₹10,000", "Quick escapes"].map((label, lane) => <div key={label} className={`rounded-[28px] p-5 ${lane === 0 ? "bg-[#d0e562]" : "bg-[#3157d5] text-white"}`}><div className="flex items-end justify-between gap-3"><div><small className="rounded-full bg-white/75 px-2 py-1 text-[8px] font-black">{label}</small><h3 className="mt-4 text-2xl font-black">{lane === 0 ? "Big memories, small maths." : "Leave before the group chat cools off."}</h3></div><Link href="/tours" className="rounded-full bg-white px-3 py-2 text-[9px] font-black text-[#151925]">See all</Link></div><div className="mt-5 grid gap-2">{tours.slice(lane, lane + 3).map((tour) => <Link key={tour.id} href={`/tours/${tour.slug}`} className="flex items-center gap-3 rounded-2xl bg-white/90 p-2 text-[#151925]"><img src={tour.featured_image || gallery[0]} alt="" className="h-14 w-14 rounded-xl object-cover" /><span className="min-w-0 flex-1"><b className="block truncate text-[11px] font-black">{tour.title}</b><small className="mt-1 block text-[8px] font-bold text-[#707b8e]">{tour.excerpt || "Group trip"}</small></span><strong className="text-[11px] font-black text-[#173fb9]">{tour.price || "Quote"}</strong></Link>)}</div></div>)}</div></div></section>

      <section id="international-trips" className="bg-[#111a34] px-4 py-16 text-white"><div className="mx-auto grid max-w-[1180px] items-center gap-8 rounded-[30px] bg-[#fff8ed] p-7 text-[#151925] md:grid-cols-[1fr_0.65fr] md:p-11"><div><span className="rounded-full bg-[#3157d5] px-3 py-2 text-[8px] font-black uppercase text-white">Passport energy</span><h2 className="mt-5 text-4xl font-black leading-none tracking-[-0.05em] md:text-6xl">The group chat is ready for an international plot twist.</h2><p className="mt-5 max-w-xl text-xs font-semibold leading-6 text-[#626c7e]">Bali, Vietnam, Thailand and more. Join the waitlist for the next crew leaving the country.</p><Link href="/contact" className="mt-6 inline-flex rounded-[14px] bg-[#d0e562] px-5 py-4 text-xs font-black text-[#263407]">Join the waitlist</Link></div><div className="relative h-[280px]"><div className="absolute left-5 top-7 h-56 w-44 rotate-6 rounded-2xl bg-[#3157d5] p-5 text-white shadow-xl"><small className="text-[8px] font-black">TRIPANZA</small><div className="mt-16 text-5xl">✈</div><b className="mt-8 block text-sm">PASSPORT TO FUN</b></div><div className="absolute right-2 top-16 h-40 w-56 -rotate-3 rounded-2xl border border-[#dce2ed] bg-white p-5 shadow-xl"><small className="text-[8px] font-black text-[#3157d5]">BOARDING PASS</small><b className="mt-8 block text-lg">Next stop: anywhere.</b><span className="mt-6 block border-t border-dashed pt-3 text-[9px] font-bold">TRIPANZA CREW</span></div></div></div></section>

      <section id="why-tripanza" className="bg-[#151a25] text-white">
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#d0e562]">Your kind of crowd</p><h2 className="mt-2 text-4xl font-black leading-none tracking-[-0.05em] md:text-5xl">People you&apos;ll actually click with.</h2><p className="mt-5 max-w-lg text-sm font-semibold leading-7 text-[#aeb7c7]">Join solo or with a friend. These trips are designed for an 18-28 community, with clear group plans, verified teams and captains who help strangers feel included.</p><div className="mt-6 flex flex-wrap gap-2">{["Solo-friendly", "18-28 community", "Women-friendly", "Captain-supported"].map((item) => <span key={item} className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[9px] font-extrabold">{item}</span>)}</div></div>
          <div className="relative grid grid-cols-2 gap-3"><img src={gallery[0]} alt="Tripanza travellers" className="h-64 w-full rounded-[28px] object-cover shadow-2xl" /><img src={gallery[1]} alt="Tripanza group moment" className="mt-12 h-64 w-full rounded-[28px] object-cover shadow-2xl" /><p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-[#d0e562] px-4 py-3 text-center text-[10px] font-black text-[#263407] shadow-xl">Strangers on day one.<br />Inside jokes by day two.</p></div>
        </div>
      </section>

      <section id="trip-faq" className="bg-[#fff8ef] px-4 py-16"><div className="mx-auto grid max-w-[1180px] gap-5 md:grid-cols-[0.7fr_1.3fr]"><div className="rounded-[30px] bg-[#3157d5] p-7 text-white"><span className="rounded-full bg-[#d0e562] px-3 py-2 text-[8px] font-black text-[#263407]">Group chat help desk</span><h2 className="mt-5 text-4xl font-black leading-none tracking-[-0.05em]">Questions before you disappear?</h2><p className="mt-5 text-xs font-semibold leading-6 text-[#dce4ff]">We&apos;re human. Ask us anything about dates, people, packing or the perfect first trip.</p><Link href="/contact" className="mt-8 inline-flex rounded-[14px] bg-white px-4 py-3 text-[10px] font-black text-[#151925]">Talk to Tripanza -&gt;</Link></div><div className="grid gap-2 rounded-[30px] bg-[#eef2ff] p-3">{[['Can I join solo?', 'Absolutely. Most people do, and our trip captains make the first hello easy.'], ['Who are these trips for?', 'Tripanza is built for young travellers looking for a friendly, structured group experience.'], ['How do I choose a trip?', 'Start with the dates or browse by destination, budget and trip length.']].map(([question, answer]) => <details key={question} className="rounded-[18px] bg-white p-4"><summary className="cursor-pointer pr-6 text-sm font-black">{question}</summary><p className="mt-3 max-w-xl text-xs font-semibold leading-6 text-[#687386]">{answer}</p></details>)}</div></div></section>

      <section className="bg-[#d0e562] px-4 py-16"><div className="mx-auto max-w-[1180px] text-center"><h2 className="text-4xl font-black leading-none tracking-[-0.05em] md:text-6xl">Stop reacting to reels. <span className="text-[#3157d5]">Go make one.</span></h2><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="#trips" className="rounded-[14px] bg-[#151925] px-5 py-4 text-xs font-black text-white">Find my next trip</Link><Link href="/tours" className="rounded-[14px] bg-white px-5 py-4 text-xs font-black text-[#151925]">Browse all trips</Link></div></div></section>
      <footer className="bg-[#d0e562] px-4 pb-10 text-center text-[10px] font-bold text-[#34430e]">India&apos;s coolest travel app <span className="px-2">♥</span> &copy; {new Date().getFullYear()} Tripanza</footer>
    </main>
  );
}
