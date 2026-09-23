"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TourDetail } from "@/lib/wp";

const LOGO = "https://tripanza.com/wp-content/uploads/2026/04/Tripanza-Logo-3.png";
const FALLBACKS = [
  "https://tripanza.com/wp-content/uploads/2022/09/WhatsApp-Image-2022-09-16-at-2.04.56-AM.jpeg",
  "https://tripanza.com/wp-content/uploads/2021/06/WhatsApp-Image-2021-07-12-at-2.28.22-AM-15-e1662666832961.jpeg",
];
const FOUNDER_AKSHAY = "https://tripanza.com/wp-content/uploads/2025/11/WhatsApp-Image-2025-11-12-at-12.50.05-AM.jpeg";
const FOUNDER_YASHIKA = "https://tripanza.com/wp-content/uploads/2026/08/1746074803319.jpg";
const WHATSAPP = "https://wa.me/918130117254";

type Filter = "all" | "saved" | string;
type MatchAnswers = { budget?: string; duration?: string; vibe?: string };

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function duration(tour: TourDetail) {
  const { days, nights } = tour.details.duration;
  return days ? `${nights || Math.max(0, Number(days) - 1)}N/${days}D` : "";
}

function startingAmount(tour: TourDetail) {
  const values = [tour.details.pricing.quad, tour.details.pricing.triple, tour.details.pricing.twin]
    .map((price) => price?.amount || 0)
    .filter((value) => value > 0);
  return values.length ? Math.min(...values) : 0;
}

function saleAmount(tour: TourDetail) {
  const price = startingAmount(tour);
  const rate = tour.details.booking.discount_rate;
  if (!price || !rate) return price;
  return tour.details.booking.discount_type === "amount"
    ? Math.max(0, price - rate)
    : Math.max(0, price * (1 - Math.min(100, rate) / 100));
}

function dateLabel(value: string, long = false) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", long
    ? { weekday: "short", day: "numeric", month: "short" }
    : { day: "numeric", month: "short" });
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00`);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function tourTerms(tour: TourDetail) {
  return Object.values(tour.terms || {}).flat().map((term) => term.name);
}

function numeric(value?: string) {
  const parsed = Number((value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function daysForTour(tour: TourDetail) {
  return Number(tour.details.duration.days) || 0;
}

function HomeImage({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  return <Image src={src || FALLBACKS[0]} alt={alt} fill sizes="(max-width: 760px) 100vw, 520px" className={className} />;
}

export default function HomeClient({ tours, siteName }: { tours: TourDetail[]; siteName: string }) {
  const router = useRouter();
  const heroVideo = tours.flatMap((tour) => tour.details.reels).find(Boolean) || "";
  const heroImage = tours.flatMap((tour) => tour.details.gallery.map((image) => image.url)).find(Boolean) || tours[0]?.featured_image || FALLBACKS[0];
  const [navScrolled, setNavScrolled] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [saved, setSaved] = useState<number[]>([]);
  const [departureMonth, setDepartureMonth] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("all");
  const [answers, setAnswers] = useState<MatchAnswers>({});
  const [postcardKind, setPostcardKind] = useState<"state" | "country">("state");
  const [now, setNow] = useState(0);
  const [videoPaused, setVideoPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 18);
    window.addEventListener("scroll", onScroll, { passive: true });
    const frame = window.requestAnimationFrame(() => {
      onScroll();
      const stored = tours.filter((tour) => window.localStorage.getItem(`tripanza_saved_tour_${tour.id}`) === "1").map((tour) => tour.id);
      setSaved(stored);
      setNow(Date.now());
    });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.removeEventListener("scroll", onScroll); window.cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, [tours]);

  const filters = useMemo(() => {
    const names = Array.from(new Set(tours.flatMap(tourTerms))).filter(Boolean).slice(0, 6);
    return ["all", "saved", ...names];
  }, [tours]);

  const searchMatches = search.trim().length >= 2
    ? tours.filter((tour) => `${tour.title} ${tour.details.destination}`.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];

  const visibleTours = tours.filter((tour) => {
    if (activeFilter === "saved") return saved.includes(tour.id);
    if (activeFilter === "all") return true;
    return tourTerms(tour).includes(activeFilter);
  }).slice(0, 6);

  const departures = useMemo(() => tours.flatMap((tour) => tour.details.departures.slice(0, 3).map((departure) => ({ tour, departure })))
    .sort((a, b) => a.departure.date.localeCompare(b.departure.date)).slice(0, 12), [tours]);
  const departureMonths = Array.from(new Set(departures.map(({ departure }) => monthKey(departure.date)))).slice(0, 7);

  const deals = tours.filter((tour) => tour.details.cashback || tour.details.booking.discount_rate > 0 || tour.details.bulk_discounts.length || tour.details.offer.ends_at).slice(0, 6);
  const reviews = tours.flatMap((tour) => tour.details.reviews.map((review) => ({ ...review, tour }))).filter((review, index, all) => all.findIndex((item) => item.author_name === review.author_name && item.text === review.text) === index).slice(0, 8);
  const gallery = tours.flatMap((tour) => tour.details.gallery.slice(0, 2).map((image) => ({ ...image, tour }))).slice(0, 24);
  const stays = tours.flatMap((tour) => tour.details.stays.map((stay) => ({ ...stay, tour }))).filter((stay) => stay.images.length).slice(0, 5);
  const reels = tours.filter((tour) => tour.details.reels.length).slice(0, 8);
  const underTen = tours.filter((tour) => saleAmount(tour) > 0 && saleAmount(tour) <= 10000).sort((a, b) => saleAmount(a) - saleAmount(b)).slice(0, 3);
  const quickTrips = tours.filter((tour) => daysForTour(tour) > 0 && daysForTour(tour) <= 5 && !underTen.some((item) => item.id === tour.id)).slice(0, 3);
  const minAdvance = Math.min(...tours.map((tour) => tour.details.booking.deposit_percentage).filter((rate) => rate > 0 && rate < 100), 100);

  const destinationCards = tours.slice(0, 8).map((tour) => {
    const haystack = `${tour.title} ${tour.details.destination} ${tourTerms(tour).join(" ")}`.toLowerCase();
    const international = /(bali|vietnam|thailand|dubai|bhutan|japan|georgia|malaysia|singapore|international)/.test(haystack);
    const weekend = daysForTour(tour) > 0 && daysForTour(tour) <= 3;
    const girls = /(girl|women)/.test(haystack);
    return { tour, kinds: [international ? "international" : "domestic", weekend ? "weekend" : "", girls ? "girls" : ""].filter(Boolean) };
  });
  const visibleDestinations = destinationCards.filter((item) => destinationFilter === "all" || item.kinds.includes(destinationFilter));

  const match = useMemo(() => {
    if (!answers.budget || !answers.duration || !answers.vibe || !tours.length) return null;
    return [...tours].sort((left, right) => scoreTour(right, answers) - scoreTour(left, answers))[0];
  }, [answers, tours]);

  function scoreTour(tour: TourDetail, values: MatchAnswers) {
    let score = 0;
    const price = saleAmount(tour);
    const length = daysForTour(tour);
    const text = `${tour.title} ${tour.details.destination} ${tourTerms(tour).join(" ")}`.toLowerCase();
    if (values.budget === "any" || !price) score += 1; else score += price <= Number(values.budget) ? 4 : -5;
    if (values.duration === "any") score += 1; else if (values.duration === "short" && length <= 4) score += 3; else if (values.duration === "long" && length >= 5) score += 3;
    if (values.vibe === "any") score += 1; else if (values.vibe === "beach" && /(goa|beach|coast)/.test(text)) score += 5; else if (values.vibe === "mountain" && /(manali|spiti|jibhi|tirthan|kasol|kedarnath|chopta|mcleod|triund|mountain|trek)/.test(text)) score += 5;
    return score;
  }

  function toggleSaved(id: number) {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem(`tripanza_saved_tour_${id}`, next.includes(id) ? "1" : "0");
      return next;
    });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const match = searchMatches[0];
    if (match) router.push(`/tours/${match.slug}`); else router.push(`/tours?search=${encodeURIComponent(search)}`);
  }

  function toggleVideo() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { void video.play(); setVideoPaused(false); } else { video.pause(); setVideoPaused(true); }
  }

  return (
    <main className="tph">
      <nav className={`tph-desktop-nav${navScrolled ? " is-scrolled" : ""}`} aria-label="Primary navigation">
        <div className="tph-shell tph-desktop-nav__inner">
          <Link href="/" className="tph-desktop-nav__brand"><Image src={LOGO} alt="" width={42} height={42} /><span>{siteName || "Tripanza"}</span></Link>
          <div className="tph-desktop-nav__links"><a href="#trips">Explore trips</a><a href="#trip-drops">Trip drops</a><a href="#why-tripanza">Why Tripanza</a></div>
          <a className="tph-desktop-nav__cta" href="#trips">Find my trip</a>
        </div>
      </nav>

      <header className="tph-profile-hero">
        <div className="tph-profile-hero__cover has-live-stage" aria-label="A real Tripanza trip moment">
          <div className="tph-desktop-live-stage">
            {heroVideo ? <video ref={videoRef} src={heroVideo} poster={heroImage} muted loop playsInline autoPlay preload="metadata" /> : <HomeImage src={heroImage} alt="Travellers on a Tripanza group trip" />}
            <span className="tph-desktop-live-stage__shade" />
            <div className="tph-desktop-live-stage__top"><span><i />Live from the trip</span>{heroVideo ? <button type="button" onClick={toggleVideo} aria-label={videoPaused ? "Play hero video" : "Pause hero video"}><b>{videoPaused ? "▶" : "Ⅱ"}</b></button> : null}</div>
            <div className="tph-desktop-live-stage__copy"><small>The group chat left home</small><strong>This is what “we should plan a trip” looks like.</strong></div>
            <span className="tph-desktop-live-stage__chat tph-desktop-live-stage__chat--one">Who packed the speaker? <b>♫</b></span>
            <span className="tph-desktop-live-stage__chat tph-desktop-live-stage__chat--two">Main-character weekend <b>✨</b></span>
            <span className="tph-desktop-live-stage__ticker">REAL PEOPLE <i /> REAL TRIPS <i /> REAL STORIES</span>
          </div>
        </div>

        <div className="tph-profile-hero__identity">
          <div className="tph-desktop-hero__copy">
            <span className="tph-desktop-hero__eyebrow">Community trips for 18–28</span>
            <h1>Your next story won&apos;t fit in the <em>group chat.</em></h1>
            <p>Join young travellers, explore somewhere unreal and come back with a camera roll full of people who stopped feeling like strangers.</p>
          </div>

          <Link className="tph-profile-hero__avatar" href="/" aria-label="Tripanza home"><Image src={LOGO} alt="Tripanza" width={152} height={152} priority /></Link>
          <div className="tph-profile-hero__name"><h1>Tripanza</h1><span aria-label="Verified">✓</span></div>
          <p className="tph-profile-hero__tagline">India&apos;s coolest travel startup</p>
          <div className="tph-profile-hero__confidence"><span>Community trips</span><i /><span>18–28 only</span><i /><span>Women-friendly</span></div>
          <div className="tph-profile-hero__switch"><a className="is-active" href="#trips"><NavIcon kind="compass" />Explore trips</a><a href="#people-planning"><NavIcon kind="calendar" />Live dates</a></div>

          <div className="tph-live-search-wrap">
            <form className="tph-search tph-profile-hero__search" onSubmit={submitSearch}>
              <span className="tph-search__icon"><NavIcon kind="search" /></span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Where do you want to disappear?" aria-label="Search trips" />
              <button type="submit"><span className="tph-search__mobile-label">Search</span><span className="tph-search__desktop-label">Show me trips</span></button>
            </form>
            {search.trim().length >= 2 ? <div className="tph-live-search">{searchMatches.length ? searchMatches.map((tour) => <Link key={tour.id} href={`/tours/${tour.slug}`} className="tph-live-search__item"><span className="tph-live-search__thumb"><HomeImage src={tour.featured_image} alt="" /></span><span><strong>{tour.title}</strong><small>{[tour.details.destination, duration(tour)].filter(Boolean).join(" • ")}</small></span><b>From {money(saleAmount(tour), tour.currency)}</b></Link>) : <p>No quick match. Press search to see every trip.</p>}</div> : null}
          </div>
          <div className="tph-quick tph-profile-hero__quick">{["Under ₹10K", "All Girls", "Every Friday", "India Trips"].map((label) => <button key={label} type="button" onClick={() => { setSearch(label); document.getElementById("trips")?.scrollIntoView({ behavior: "smooth" }); }}>{label}</button>)}</div>
        </div>
      </header>

      <section className="tph-proof"><div className="tph-shell tph-proof__inner">{[["2016", "Exploring since", "Building youth travel, one group at a time."], ["50K+", "Happy travellers", "People who turned plans into stories."], ["1000+", "Trips created", "Designed around people, not only destinations."]].map(([metric, title, copy]) => <div className="tph-proof__item" key={metric}><span className="tph-proof__metric">{metric}</span><div><strong>{title}</strong><small>{copy}</small></div></div>)}</div></section>

      {departures.length ? <section className="tph2-social" id="people-planning"><div className="tph-shell"><div className="tph2-social__top"><div><div className="tph2-kicker"><span>⚡</span> Leaving soon</div><h2>Pick a date. <span>Meet your crew.</span></h2></div></div><div className="tph2-live-months">{["all", ...departureMonths].map((month) => <button key={month} className={departureMonth === month ? "is-active" : ""} onClick={() => setDepartureMonth(month)}>{month === "all" ? "All dates" : monthLabel(month)}</button>)}</div><div className="tph2-social__stage"><div className="tph2-social__rail">{departures.filter(({ departure }) => departureMonth === "all" || monthKey(departure.date) === departureMonth).map(({ tour, departure }, index) => <Link className={`tph2-social-card${index === 1 ? " is-active" : ""}${departure.promoted ? " is-promoted" : ""}`} href={`/tours/${tour.slug}`} key={`${tour.id}-${departure.date}`}><HomeImage src={tour.featured_image} alt={tour.title} /><span className="tph2-social-card__shade" /><span className="tph2-social-card__status">{departure.promoted ? departure.badge || "Recommended" : departure.status}</span><span className="tph2-social-card__copy"><h3>{tour.title}</h3><span>{dateLabel(departure.date, true)}{tour.details.origin ? ` / From ${tour.details.origin}` : ""}</span><span className="tph2-social-card__bottom"><small><strong>{money(saleAmount(tour), tour.currency)}</strong></small><b>View trip →</b></span></span></Link>)}</div></div><div className="tph2-social__picks">{departures.slice(0, 9).map(({ tour, departure }, index) => <button type="button" className={index === 1 ? "is-active" : ""} key={`pick-${tour.id}-${departure.date}`} onClick={() => document.querySelectorAll<HTMLElement>(".tph2-social-card")[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })}><span><HomeImage src={tour.featured_image} alt="" /></span><small>{tour.details.destination || tour.title}</small></button>)}</div></div></section> : null}

      {deals.length ? <section className="tph2-deals" id="deal-drops"><div className="tph-shell"><div className="tph2-deals__head"><div><div className="tph2-kicker">Deal drop</div><h2 className="tph2-title">Your budget just <span>caught a break.</span></h2></div></div><div className="tph2-deals__grid">{deals.map((tour) => { const base = startingAmount(tour); const sale = saleAmount(tour); const cashback = numeric(tour.details.cashback); const bulk = [...tour.details.bulk_discounts].sort((a, b) => a.from - b.from)[0]; const end = Date.parse(tour.details.offer.ends_at); const remaining = end - now; return <Link href={`/tours/${tour.slug}`} className={`tph2-deal${remaining > 0 ? " has-timer" : ""}`} key={tour.id}><span className="tph2-deal__media"><HomeImage src={tour.featured_image} alt={tour.title} /><i className="tph2-deal__flash">{cashback ? "₹" : tour.details.booking.discount_type === "percent" ? "%" : "⚡"}</i></span><span className="tph2-deal__body"><h3>{tour.title}</h3><span className="tph2-deal__meta"><span>{tour.details.destination || "Tripanza trip"}</span>{duration(tour) ? <span>{duration(tour)}</span> : null}</span><span className="tph2-deal__tags">{cashback ? <span className="tph2-deal__tag tph2-deal__tag--cashback">{money(cashback, tour.currency)} cashback / person</span> : null}{tour.details.booking.discount_rate ? <span className="tph2-deal__tag">{tour.details.booking.discount_type === "percent" ? `${tour.details.booking.discount_rate}% off` : `Save ${money(tour.details.booking.discount_rate, tour.currency)}`}</span> : null}{bulk ? <span className="tph2-deal__tag tph2-deal__tag--group">{bulk.type === "percent" ? `${bulk.value}%` : money(bulk.value, tour.currency)} off from {bulk.from} travellers</span> : null}</span>{remaining > 0 ? <span className="tph2-deal__timer"><span>{tour.details.offer.note || "Offer closes in"}</span><strong>{countdown(remaining)}</strong></span> : null}<span className="tph2-deal__bottom"><span className="tph2-deal__price"><small>Trip from</small><strong>{money(sale, tour.currency)}{base > sale ? <del>{money(base, tour.currency)}</del> : null}</strong></span><span className="tph2-deal__cta">See deal →</span></span></span></Link>; })}</div></div></section> : null}

      <section id="trips" className="tph-section"><div className="tph-shell"><div className="tph-head"><div><div className="tph-eyebrow">Currently passing the vibe check</div><h2>Trips worth sending to the group chat.</h2></div></div><div className="tph-filters">{filters.map((filter) => <button key={filter} onClick={() => setActiveFilter(filter)} className={activeFilter === filter ? "is-active" : ""}>{filter === "all" ? "All trips" : filter === "saved" ? "Saved ♥" : filter}</button>)}</div><div className="tph-grid">{visibleTours.map((tour) => <article className="tph-card" key={tour.id}><Link className="tph-card__media" href={`/tours/${tour.slug}`}><HomeImage src={tour.featured_image} alt={tour.title} />{tour.details.is_premium ? <span className="tph-card__badge">Premium</span> : null}<span className="tph-card__route">{[tour.details.origin, tour.details.destination].filter(Boolean).join(" to ")}</span></Link><button type="button" className={`tph-save${saved.includes(tour.id) ? " is-saved" : ""}`} onClick={() => toggleSaved(tour.id)} aria-label="Save trip">{saved.includes(tour.id) ? "♥" : "♡"}</button><div className="tph-card__body"><Link className="tph-card__title" href={`/tours/${tour.slug}`}>{tour.title}</Link><div className="tph-card__meta">{duration(tour) ? <span>{duration(tour)}</span> : null}{tour.details.rating.value > 0 ? <span>★ {tour.details.rating.value.toFixed(1)} ({tour.details.rating.count})</span> : null}<span>{tour.details.partner.name || "Tripanza"}</span></div><div className="tph-card__bottom"><span><small>Starts from</small><strong>{money(saleAmount(tour), tour.currency)}</strong></span>{tour.details.departures[0] ? <span><b>Next: {dateLabel(tour.details.departures[0].date)}</b><small>{tour.details.departures[0].status}</small></span> : null}</div></div></article>)}</div>{!visibleTours.length ? <p className="tph-empty">{activeFilter === "saved" ? "No saved trips yet. Tap the heart on a trip you like." : "No trip matches that yet."}</p> : null}<div className="tph-all"><Link href="/tours">Explore every trip →</Link></div></div></section>

      <section className="tph2-confidence"><div className="tph-shell"><div className="tph2-confidence__card"><div className="tph2-confidence__head"><div><div className="tph2-kicker">No shady booking energy</div><h2>Know the plan. Know the price.</h2></div><p>No surprise charges. No disappearing humans.</p></div><div className="tph2-confidence__grid">{minAdvance < 100 ? <InfoTile icon="₹" title="Start small" copy={`Reserve eligible trips from ${minAdvance}% and pay the rest later.`} /> : null}<InfoTile icon="✓" title="See every rupee" copy="The complete payable amount appears before you pay." /><InfoTile icon="@" title="Proof in your inbox" copy="Your confirmed booking details stay easy to find." /><InfoTile icon="☺" title="Humans stay around" copy="Talk to Tripanza before and after you book." /></div><small>Advance changes by trip. Checkout shows exactly what you pay now and what comes later.</small></div></div></section>

      {reviews.length ? <section className="tph2-section tph2-reviews" id="traveller-reviews"><div className="tph-shell"><div className="tph2-head"><div><div className="tph2-kicker">Receipts from the road</div><h2 className="tph2-title">Proof the group chat made it out.</h2></div><div className="tph2-review-score"><strong>{(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)}</strong><span>Rated on Google</span></div></div><div className="tph2-scroll">{reviews.map((review, index) => <article className="tph2-review" key={`${review.author_name}-${index}`}><div className="tph2-review__person">{review.profile_photo_url ? <Image src={review.profile_photo_url} alt="" width={44} height={44} unoptimized /> : <span>{review.author_name.charAt(0)}</span>}<div><strong>{review.author_name}</strong><small>{review.date}</small></div><b>G</b></div><div className="tph2-stars">{"★".repeat(Math.round(review.rating))}{"☆".repeat(5 - Math.round(review.rating))}</div><blockquote>{review.text}</blockquote><span className="tph2-review__quote">“</span></article>)}</div></div></section> : null}

      {gallery.length ? <section className="tph2-camera" id="tripanza-camera-roll"><div className="tph-shell"><div className="tph2-kicker">Straight from the group chat</div><h2 className="tph2-title">Proof the group chat actually left the chat.</h2></div><div className="tph2-camera__viewport">{[0, 1].map((row) => <div className={`tph2-camera__track${row ? " is-reverse" : ""}`} key={row}>{[...gallery.slice(row * 8, row * 8 + 8), ...gallery.slice(row * 8, row * 8 + 8)].map((photo, index) => <Link href={`/tours/${photo.tour.slug}`} className="tph2-camera__photo" key={`${row}-${photo.tour.id}-${index}`}><HomeImage src={photo.url} alt={photo.alt || photo.tour.title} /><span>{["Crew cam", "Trip frame", "Road drop"][index % 3]}<strong>{photo.tour.title}</strong></span></Link>)}</div>)}</div><div className="tph-shell tph2-camera__foot"><span>{gallery.length} memories in this roll</span><Link href="/tours">Find your frame →</Link></div></section> : null}

      {stays.length ? <section className="tph2-section tph2-stays" id="trip-stays"><div className="tph-shell"><div className="tph2-head"><div><div className="tph2-kicker">Sleep scene</div><h2 className="tph2-title">Where you&apos;ll wake up matters.</h2></div><div className="tph2-stay-trust">✓ <span><strong>No room roulette</strong><small>Real stays. Actually checked.</small></span></div></div><div className="tph2-stay-guide">✦ Swipe through the rooms. Screenshot your favourite.</div><div className="tph2-stay-grid">{stays.map((stay) => <Link href={`/tours/${stay.tour.slug}`} className="tph2-stay" key={`${stay.tour.id}-${stay.title}`}><HomeImage src={stay.images[0]} alt={stay.title} /><span className="tph2-stay__checked">✓ Checked stay</span><span className="tph2-stay__copy"><small>{stay.tour.title}</small><strong>{stay.title}</strong><span>{[stay.location, stay.type].filter(Boolean).join(" · ")}</span><em>{stay.amenities.slice(0, 3).join(" · ")}</em></span></Link>)}</div><p className="tph2-stay-note">Property is subject to availability; a similar or upgraded stay may be arranged when required.</p></div></section> : null}

      <section className="tph2-section tph2-destinations" id="destinations"><div className="tph-shell"><div className="tph2-head"><div><div className="tph2-kicker">Pick a pin. Find your people.</div><h2 className="tph2-title">Where are we disappearing to?</h2></div></div><div className="tph2-tabs">{[["all", "All"], ["domestic", "India"], ["international", "International"], ["weekend", "Weekend"], ["girls", "All Girls"]].map(([value, label]) => <button key={value} onClick={() => setDestinationFilter(value)} className={destinationFilter === value ? "is-active" : ""}>{label}</button>)}</div>{visibleDestinations.length ? <div className="tph2-destination-grid">{visibleDestinations.slice(0, 7).map(({ tour }, index) => <Link href={`/tours/${tour.slug}`} className={`tph2-destination${index === 0 ? " is-featured" : ""}`} key={tour.id}><HomeImage src={tour.featured_image} alt={tour.title} /><span><small>{tour.details.destination || "India"}</small><strong>{tour.title}</strong><em>{duration(tour)} · From {tour.details.origin || "Delhi"}</em><b>From {money(saleAmount(tour), tour.currency)}</b></span></Link>)}</div> : <div className="tph2-destination-empty"><strong>Passport era loading.</strong><p>Our international community trips are getting ready. Join the drop list and hear before everyone else.</p><a href={WHATSAPP}>Notify me on WhatsApp</a></div>}</div></section>

      {reels.length ? <section className="tph-section tph-reels-section" id="trip-drops"><div className="tph-shell tph-head"><div><div className="tph-eyebrow">No brochure energy</div><h2>Watch the vibe before you commit.</h2></div></div><div className="tph-reels">{reels.map((tour) => <Link className="tph-reel" href={`/tours/${tour.slug}`} key={tour.id}><video src={tour.details.reels[0]} muted loop playsInline preload="metadata" poster={tour.featured_image || undefined} onMouseEnter={(event) => void event.currentTarget.play()} onMouseLeave={(event) => event.currentTarget.pause()} /><span className="tph-reel__play">▶</span><span className="tph-reel__copy"><small>{duration(tour)}</small><strong>{tour.title}</strong></span></Link>)}</div></section> : null}

      <section className="tph-section tph-manifesto" id="why-tripanza"><div className="tph-shell tph-manifesto__grid"><div><div className="tph-eyebrow">Your kind of crowd</div><h2>People you&apos;ll actually click with.</h2><p>Join solo or with a friend. These trips are designed for an 18–28 community, with clear group plans, verified teams and captains who help strangers feel included.</p><div className="tph-manifesto__pills">{["Solo-friendly", "18–28 community", "Women-friendly", "Captain-supported"].map((item) => <span key={item}>{item}</span>)}</div></div><div className="tph-collage"><span><HomeImage src={gallery[0]?.url || FALLBACKS[0]} alt="Tripanza travellers" /></span><span><HomeImage src={gallery[1]?.url || FALLBACKS[1]} alt="Real trip moment" /></span><div>Strangers on day one. Inside jokes by day two.</div></div></div></section>

      <section className="tph2-section tph2-shortcuts" id="quick-picks"><div className="tph-shell"><div className="tph2-head"><div><div className="tph2-kicker">Pick your excuse</div><h2 className="tph2-title">Different plans. Same main-character energy.</h2></div></div><div className="tph2-shortcut-grid"><Shortcut title="Under ₹10K" kicker="Budget understood" tours={underTen.length ? underTen : tours.slice(0, 3)} /><Shortcut title="Quick escapes" kicker="Low leave balance?" tours={quickTrips.length ? quickTrips : tours.slice(3, 6)} /></div></div></section>

      <section className="tph2-section tph2-find" id="find-my-vibe"><div className="tph-shell"><div className="tph2-find__card"><div className="tph2-find__quiz"><div className="tph2-kicker">Three taps. Zero overthinking.</div><h2>Find the trip matching your current mood.</h2><MatchQuestion label="Your budget?" name="budget" values={[["10000", "Under ₹10K"], ["15000", "Under ₹15K"], ["any", "Worth it > cheap"]]} answers={answers} setAnswers={setAnswers} /><MatchQuestion label="How long can you disappear?" name="duration" values={[["short", "Weekend-ish"], ["long", "Proper escape"], ["any", "Flexible"]]} answers={answers} setAnswers={setAnswers} /><MatchQuestion label="Pick the energy." name="vibe" values={[["mountain", "Mountain chaos"], ["beach", "Beach energy"], ["any", "Surprise me"]]} answers={answers} setAnswers={setAnswers} /></div><div className="tph2-match">{match ? <article className="tph2-match__result"><span className="tph2-match__media"><HomeImage src={match.featured_image} alt={match.title} /><b>Found your vibe</b></span><div><small>Your trip match</small><strong>{match.title}</strong><span>{duration(match)} · {match.details.destination}</span><b>{money(saleAmount(match), match.currency)}</b><Link href={`/tours/${match.slug}`}>See this trip</Link></div></article> : <div className="tph2-match__empty"><span>Your trip moodboard</span><div>{tours.slice(0, 3).map((tour) => <span key={tour.id}><HomeImage src={tour.featured_image} alt="" /></span>)}</div><strong>Pick your mood. We will find the scene.</strong><small>Three choices. One trip that actually fits.</small></div>}</div></div></div></section>

      <section className="tph2-paylater" id="travel-now-pay-later"><div className="tph-shell"><div className="tph2-paylater__card"><div className="tph2-paylater__copy"><small>Plot twist for your trip budget</small><h2><del>Pay now. Travel later.</del><span>Travel now. Pay later.</span></h2><p>On eligible bookings, choose an available EMI or Pay Later option at checkout and split the trip cost into manageable payments.</p><Link href="/tours">Find your next trip</Link></div><div className="tph2-paylater__visual"><div className="tph2-paylater__pass"><div><span><small>FROM</small><strong>Someday</strong></span><b>✈</b><span><small>TO</small><strong>Right now</strong></span></div><div>{["Pick trip", "Choose EMI", "Pack bags"].map((step, index) => <span key={step}><small>Step {index + 1}</small><strong>{step}</strong></span>)}</div><p>PayU-supported secure checkout</p></div><span>Trip first<br />EMIs after</span></div><div className="tph2-paylater__banks"><small>EMI options across major eligible banks</small>{["HDFC", "ICICI", "SBI", "AXIS", "KOTAK", "BOB"].map((bank) => <span key={bank}>{bank}</span>)}</div><p className="tph2-paylater__fine">EMI, BNPL, interest, tenure and eligibility depend on the issuing bank, payment method, transaction value and the options returned by PayU at checkout.</p></div></div></section>

      <section className="tph2-section tph2-money" id="where-money-goes"><div className="tph-shell"><div className="tph2-safe"><div><div className="tph2-kicker">Two humans. Zero faceless booking.</div><h2>Your trip money is safe with Akshay &amp; Yashika.</h2><p>No faceless marketplace energy. The founders are right here—and accountable for every Tripanza booking.</p></div><div className="tph2-safe__people"><Founder image={FOUNDER_AKSHAY} label="The builder" name="Akshay Verma" role="Builds the booking tech" /><Founder image={FOUNDER_YASHIKA} label="The people person" name="Yashika Taneja" role="Helps travellers book right" /></div><div className="tph2-safe__bottom"><span>● Booking ka doubt? Ask the humans behind the trip.</span><Link href="/about">Meet your trip people →</Link></div></div></div></section>

      <section className="tph2-section tph2-international" id="international-trips"><div className="tph-shell"><div className="tph2-head"><div><div className="tph2-kicker">Next stamp incoming</div><h2 className="tph2-title">Passport ready. Group chat pending.</h2></div><span>Visa era loading · Boarding soon ✈</span></div><div className="tph2-int-waitlist"><div><small>Your passport era starts here</small><h3>International trips are almost boarding.</h3><p>Bali, Vietnam, Thailand and more are on our radar. Join the drop list—no spam, just launch updates and real departures.</p><div><span>Bali</span><span>Vietnam</span><span>Thailand</span><span>More loading…</span></div><a href={WHATSAPP}>Get on the first-drop list</a></div><div className="tph2-int-visual"><span>📷</span><span>🧳</span><span>🌴</span><div><small>TRIPANZA</small><b>✦</b><strong>PASSPORT</strong><em>WORLD TRIP ERA</em></div><p>DEL ✈ WORLD</p></div></div></div></section>

      <section className="tph2-playlist" id="travel-playlists"><div className="tph-shell"><div className="tph2-head"><div><div className="tph2-kicker">Tripanza on AUX</div><h2 className="tph2-title">Put this on before the aux war starts.</h2></div><span>♫ Opens in Spotify</span></div><div className="tph2-playlist__rail">{["Rasta — The Best Hindi Travel Playlist", "2026 Travel Jukebox", "Hindi road-trip songs", "Hindi travel vibes", "Classic road-trip songs", "Roadtrip songs everyone knows"].map((title, index) => <a className="tph2-track" href="https://open.spotify.com/search/travel%20playlist" target="_blank" rel="noreferrer" key={title}><span className={`tph2-track__cover tone-${index % 4}`}>♫</span><small>Playlist {String(index + 1).padStart(2, "0")}</small><strong>{title}</strong><p>{index < 2 ? "Hindi drive songs" : "Road-trip energy for the crew"}</p><i /><span>◀　▶　▶❘</span></a>)}</div></div></section>

      <section className="tph2-postcards" id="trip-postcards"><div className="tph-shell"><div className="tph2-head"><div><div className="tph2-kicker">Collect your next place</div><h2 className="tph2-title">States now. Countries next.</h2></div><span>Tripanza postcard club</span></div><div className="tph2-postcards__tabs"><button className={postcardKind === "state" ? "is-active" : ""} onClick={() => setPostcardKind("state")}>India state drops <b>4</b></button><button className={postcardKind === "country" ? "is-active" : ""} onClick={() => setPostcardKind("country")}>Country drops incoming <b>4</b></button></div><div className="tph2-postcards__desk">{(postcardKind === "state" ? [["Himachal", "Mountain mornings & chai"], ["Uttarakhand", "Trails, temples & tiny roads"], ["Rajasthan", "Forts, sunsets & stories"], ["Goa", "Salt air, scenes & sunsets"]] : [["Thailand", "Night markets loading"], ["Vietnam", "Lantern streets loading"], ["Indonesia", "Bali era incoming"], ["Georgia", "Snow, streets & wine"]]).map(([place, copy], index) => { const tour = tours[(index + (postcardKind === "country" ? 4 : 0)) % Math.max(1, tours.length)]; return <Link className="tph2-postcard" href={tour ? `/tours/${tour.slug}` : "/tours"} key={place}><span className="tph2-postcard__art"><HomeImage src={tour?.featured_image} alt={place} /><em>Greetings from</em><b>{place}</b><u>{postcardKind === "state" ? "India state series" : "Passport series"}</u></span><span className="tph2-postcard__copy"><span><small>Tripanza postcard</small><strong>{tour?.title || place}</strong><em>{copy}</em></span><i className="tph2-postcard__stamp">✈<small>TPZ</small></i></span></Link>; })}</div><div className="tph2-postcards__foot"><span>Start with a state. Graduate to a passport stamp.</span><Link href="/tours">Pick a place →</Link></div></div></section>

      <section className="tph2-section tph2-faq" id="trip-faq"><div className="tph-shell tph2-faq__layout"><div className="tph2-faq__intro"><div className="tph2-kicker">No awkward questions</div><h2 className="tph2-title">Ask before the group chat does.</h2><p>Straight answers for first-time community travellers. No confusing travel jargon.</p><div><span>Solo aa sakte hain?</span><span>Girls ke liye safe?</span><span>Kitna pay now?</span></div><a href={WHATSAPP}>Still confused? Ask a human</a></div><div className="tph2-faq__list">{[["Can I join a Tripanza trip alone?", "Yes. These community trips welcome solo travellers as well as friends, and the trip team helps everyone settle into the group."], ["Who usually joins?", "This youth collection is designed for travellers aged 18–28. Check the individual trip page for its batch and audience details."], ["How does Tripanza support women travellers?", "Stay, transport, captain and batch details are shared where available, with human support before and during the trip."], ["Who leads the group?", "Group departures are supported by the trip captain or team shown on the trip page."], ["How much do I pay now?", "Checkout shows the valid price breakdown, advance payable now and remaining balance before payment."]].map(([question, answer], index) => <details key={question} open={index === 0 ? true : undefined}><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>

      <section className="tph2-help"><div className="tph-shell"><div className="tph2-help__card"><div><span>💬</span><div><small>Real human. Real reply.</small><h3>Group chat stuck?</h3><p>Dates, budget ya pickup—bas ping karo. We will help you pick.</p></div></div><span>Dates?　Budget?　Pickup?</span><a href={WHATSAPP}>Ask on WhatsApp</a></div></div></section>

      <section className="tph-final"><div className="tph-shell"><div className="tph-final__card"><h2>Stop reacting to reels. <span>Go make one.</span></h2><div><a href="#trips">Find my next trip</a><Link href="/tours">Watch trip drops</Link></div></div><footer><strong>India&apos;s coolest travel app <span>♥</span></strong><small>© {new Date().getFullYear()} Tripanza<br />Community trips for young India.</small></footer></div></section>

      <nav className="tph-mobile-dock" aria-label="Mobile navigation">
        <Link className="is-active" href="/"><NavIcon kind="home" /><span>Home</span></Link>
        <a href="#why-tripanza"><NavIcon kind="people" /><span>Icebreaker</span></a>
        <a className="is-primary" href="#trips"><span className="tph-mobile-dock__create"><NavIcon kind="explore" /></span><span>Explore</span></a>
        <a href="#trips" onClick={() => setActiveFilter("saved")}><NavIcon kind="heart" /><span>Saved</span></a>
        <Link href="/account"><NavIcon kind="user" /><span>Me</span></Link>
      </nav>
    </main>
  );
}

function countdown(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${days ? `${days}d ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function InfoTile({ icon, title, copy }: { icon: string; title: string; copy: string }) {
  return <div className="tph2-confidence__item"><i>{icon}</i><strong>{title}</strong><small>{copy}</small></div>;
}

function Shortcut({ title, kicker, tours }: { title: string; kicker: string; tours: TourDetail[] }) {
  return <article className="tph2-shortcut"><div className="tph2-shortcut__top"><div><small>{kicker}</small><h3>{title}</h3></div><Link href="/tours">See all →</Link></div><div>{tours.map((tour) => <Link className="tph2-mini" href={`/tours/${tour.slug}`} key={tour.id}><span><HomeImage src={tour.featured_image} alt="" /></span><span><strong>{tour.title}</strong><small>{duration(tour)} · From {tour.details.origin || "Delhi"}</small></span><b>{money(saleAmount(tour), tour.currency)}</b></Link>)}</div></article>;
}

function Founder({ image, label, name, role }: { image: string; label: string; name: string; role: string }) {
  return <article><span><HomeImage src={image} alt={name} /></span><div><small>{label}</small><strong>{name}</strong><p>{role}</p><b>✓</b></div></article>;
}

function MatchQuestion({ label, name, values, answers, setAnswers }: { label: string; name: keyof MatchAnswers; values: string[][]; answers: MatchAnswers; setAnswers: React.Dispatch<React.SetStateAction<MatchAnswers>> }) {
  return <div className="tph2-question"><span>{label}</span><div>{values.map(([value, text]) => <button type="button" key={value} className={answers[name] === value ? "is-active" : ""} onClick={() => setAnswers((current) => ({ ...current, [name]: value }))}>{text}</button>)}</div></div>;
}

function NavIcon({ kind }: { kind: "search" | "compass" | "calendar" | "home" | "people" | "explore" | "heart" | "user" }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    home: <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
    people: <><path d="M15 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 3 18.5V20" /><circle cx="9" cy="8" r="3.5" /><path d="M17 8v6M14 11h6" /></>,
    explore: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 2v5M16 2v5M4 10h16M9 14l2 2 4-4" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[kind]}</svg>;
}
