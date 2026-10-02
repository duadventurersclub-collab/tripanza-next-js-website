import Link from "next/link";
import type { HostTour } from "@/lib/host";

const labels = ["THE CREW", "THE VIEW", "THE MOMENT", "THE MEMORY"];

export default function HostProfileCamera({ trips }: { trips: HostTour[] }) {
  const photos = trips.flatMap(trip => (trip.gallery || []).map(url => ({ url, trip }))).slice(0, 20);
  if (!photos.length) return null;
  const midpoint = Math.ceil(photos.length / 2);
  const rows = [photos.slice(0, midpoint), photos.slice(midpoint)].filter(row => row.length);

  return <section className="tp-host-camera" id="tripanza-camera-roll"><header className="tp-host-camera__head"><span>Straight from the group chat</span><h2>Proof the group chat actually left the chat.</h2></header><div className="tp-host-camera__viewport">{rows.map((row, rowIndex) => <div className={`tp-host-camera__lane ${rowIndex === 1 ? "is-reverse" : ""}`} key={rowIndex}><div className="tp-host-camera__track">{[0, 1].map(repeat => <div className="tp-host-camera__group" aria-hidden={repeat === 1} key={repeat}>{row.map(({ url, trip }, photoIndex) => <Link className="tp-host-camera__photo" href={`/tours/${trip.slug}`} tabIndex={repeat === 1 ? -1 : 0} key={`${trip.id}-${photoIndex}`}><img src={url} alt={repeat === 1 ? "" : trip.title} /><span className="tp-host-camera__overlay"><small>{labels[(photoIndex + rowIndex) % labels.length]}</small><strong>{trip.title}</strong><b>See trip →</b></span></Link>)}</div>)}</div></div>)}</div><div className="tp-host-camera__foot"><span>{photos.length} memories in this roll</span><a href="#tpHostTrips">Find your frame →</a></div></section>;
}
