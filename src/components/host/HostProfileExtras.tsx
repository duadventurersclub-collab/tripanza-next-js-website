import Link from "next/link";
import type { HostProfile } from "@/lib/host";
import HostProfileCommerce from "./HostProfileCommerce";

export default function HostProfileExtras({ profile }: { profile: HostProfile }) {
  const today = new Date().toISOString().slice(0, 10);
  const departures = profile.trips.flatMap(trip => trip.selected_dates.filter(date => date >= today).map(date => ({ date, trip }))).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);
  const destinations = Array.from(new Map(profile.trips.filter(trip => trip.address && trip.image).map(trip => [trip.address.toLowerCase(), trip])).values()).slice(0, 6);

  return <>
    {departures.length > 0 && <section className="tp-host-soon" id="tpHostLeavingSoon"><div className="tp-host-soon__shell"><header className="tp-host-soon__head"><div><span><i>⚡</i>Leaving soon</span><h2>Pick a date. <em>Meet your crew.</em></h2></div></header><div className="tp-host-soon__stage"><div className="tp-host-live-rail" tabIndex={0} aria-label={`Live departures from ${profile.name}`}>{departures.map(({ date, trip }, index) => <Link id={`tpHostDeparture${index}`} href={`/tours/${trip.slug}`} className={`tp-host-live-card ${index === 0 ? "is-active" : ""}`} key={`${trip.id}-${date}`}>{trip.image && <img src={trip.image} alt={trip.title} />}<span className="tp-host-live-card__shade" /><span className="tp-host-live-card__status">Seats subject to availability</span><span className="tp-host-live-card__copy"><strong>{trip.title}</strong><span>{new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} / From {trip.address || "India"}</span><span className="tp-host-live-card__bottom"><small>Check live price</small><b>View trip →</b></span></span></Link>)}</div></div><div className="tp-host-live-picks">{departures.map(({ date, trip }, index) => <a href={`#tpHostDeparture${index}`} key={`${trip.id}-${date}`}><span>{trip.image && <img src={trip.image} alt="" />}</span><small>{trip.title}</small></a>)}</div></div></section>}
    <HostProfileCommerce profile={profile} />
    {destinations.length > 1 && <section className="tp-host-destinations"><div className="tp-host-destinations__shell"><header className="tp-host-destinations__head"><span>PICK A PIN. FIND YOUR PEOPLE.</span><h2>Where are we disappearing to?</h2></header><div className={`tp-host-destination-grid has-${destinations.length}`}>{destinations.map((trip,index) => <article className={`tp-host-destination ${index === 0 && destinations.length >= 5 ? "is-featured" : ""}`} key={trip.id}><Link className="tp-host-destination__slides" href={`/tours/${trip.slug}`}><img className="tp-host-destination__image is-active" src={trip.image} alt={trip.address} /></Link><Link className="tp-host-destination__copy" href={`/tours/${trip.slug}`}><strong>{trip.address}</strong><em>{trip.title}</em><span><b>Explore →</b></span></Link></article>)}</div></div></section>}
  </>;
}
