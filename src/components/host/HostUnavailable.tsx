import Link from "next/link";

export default function HostUnavailable() {
  return <main className="mx-auto w-full max-w-2xl px-6 py-24"><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Tripanza Host</p><h1 className="mt-3 text-4xl font-black">Hosting is currently unavailable.</h1><p className="mt-5 text-slate-600">The Host feature is turned off or temporarily unavailable. Existing trips and bookings have not been deleted. You can still access your traveller account.</p><div className="mt-7 flex gap-5"><Link href="/?tripanza_view=all#trips" className="font-bold text-blue-700">Explore trips →</Link><Link href="/dashboard" className="font-bold text-blue-700">My bookings</Link></div></main>;
}
