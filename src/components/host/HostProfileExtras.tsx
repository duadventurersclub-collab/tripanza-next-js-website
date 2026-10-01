import Link from "next/link";
import type { HostProfile } from "@/lib/host";

export default function HostProfileExtras({ profile }: { profile: HostProfile }) {
  const today = new Date().toISOString().slice(0, 10);
  const departures = profile.trips.flatMap(trip => trip.selected_dates.filter(date => date >= today).map(date => ({ date, trip }))).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);
  const destinations = Array.from(new Map(profile.trips.filter(trip => trip.address && trip.image).map(trip => [trip.address.toLowerCase(), trip])).values()).slice(0, 6);

  return <>
    {departures.length > 0 && <section className="host-section"><div className="host-section-head"><div><span className="host-eyebrow">⚡ LEAVING SOON</span><h2>Pick a date. <em>Meet your crew.</em></h2></div></div><div className="host-date-rail">{departures.map(({ date, trip }) => <Link href={`/tours/${trip.slug}`} className="host-date-card" key={`${trip.id}-${date}`} style={trip.image ? { backgroundImage: `linear-gradient(180deg,#0b142141,#08111fcf),url(${trip.image})` } : undefined}><span>Seats subject to live availability</span><div><strong>{trip.title}</strong><small>{new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · From {trip.address || "India"}</small><b>View trip →</b></div></Link>)}</div></section>}
    {destinations.length > 1 && <section className="host-section"><div className="host-section-head"><div><span className="host-eyebrow">PICK A PIN. FIND YOUR PEOPLE.</span><h2>Where are we <em>disappearing to?</em></h2></div></div><div className="host-destination-grid">{destinations.map(trip => <Link href={`/tours/${trip.slug}`} className="host-destination-card" key={trip.id} style={{ backgroundImage: `linear-gradient(180deg,#0b142122,#08111fd9),url(${trip.image})` }}><span><strong>{trip.address}</strong><small>{trip.title}</small><b>Explore →</b></span></Link>)}</div></section>}
  </>;
}
