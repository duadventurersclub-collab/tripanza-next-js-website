import Image from "next/image";
import Link from "next/link";
import CartActions from "@/components/booking/CartActions";
import { formatBookingMoney, getBookingCart, requestBookingQuote } from "@/lib/booking";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const stored = await getBookingCart();
  let cart = stored;
  let unavailable = "";
  if (stored) {
    try {
      const quote = await requestBookingQuote(stored.selection);
      cart = { ...stored, quote, updated_at: new Date().toISOString() };
    } catch (error) {
      unavailable = error instanceof Error ? error.message : "This booking can no longer be validated.";
    }
  }

  if (!cart) {
    return <main className="min-h-screen bg-slate-50 px-5 py-20"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><span className="text-4xl">🧳</span><h1 className="mt-4 text-3xl font-black text-slate-950">Your cart is empty</h1><p className="mt-3 text-slate-500">Choose a live departure and room-sharing option to continue.</p><Link href="/tours" className="mt-7 inline-flex rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white">Explore tours</Link></div></main>;
  }

  const { quote } = cart;
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8"><p className="text-xs font-black uppercase tracking-[.2em] text-blue-600">Your cart</p><h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Review your trip</h1><p className="mt-2 text-sm text-slate-500">This fare has been recalculated directly by ST Tours.</p></div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row">
              {quote.tour.image ? <Image src={quote.tour.image} alt="" width={220} height={150} className="h-40 w-full rounded-2xl object-cover sm:w-52" /> : null}
              <div className="min-w-0 flex-1"><span className="text-xs font-black uppercase tracking-wider text-blue-600">ST Tour</span><h2 className="mt-2 text-2xl font-black text-slate-950">{quote.tour.title}</h2><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Departure</dt><dd className="mt-1 font-bold text-slate-900">{new Date(`${quote.departure.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</dd></div><div><dt className="text-slate-500">Travellers</dt><dd className="mt-1 font-bold text-slate-900">{quote.travellers.total}</dd></div><div><dt className="text-slate-500">Sharing</dt><dd className="mt-1 font-bold text-slate-900">{[quote.travellers.quad && `${quote.travellers.quad} quad`, quote.travellers.triple && `${quote.travellers.triple} triple`, quote.travellers.twin && `${quote.travellers.twin} twin`].filter(Boolean).join(" · ")}</dd></div><div><dt className="text-slate-500">Quote valid until</dt><dd className="mt-1 font-bold text-slate-900">{new Date(quote.expires_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</dd></div></dl><div className="mt-6"><CartActions /></div></div>
            </div>
            {quote.extras.length ? <div className="mt-6 border-t border-slate-100 pt-5"><h3 className="text-sm font-black text-slate-950">Selected add-ons</h3><ul className="mt-3 space-y-2 text-sm text-slate-600">{quote.extras.map((extra) => <li className="flex justify-between" key={extra.name}><span>{extra.name} × {extra.quantity}</span><strong>{formatBookingMoney(extra.total, quote.currency)}</strong></li>)}</ul></div> : null}
            {unavailable ? <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{unavailable}</p> : null}
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-lg font-black text-slate-950">Fare summary</h2>
            <dl className="mt-5 space-y-3 border-b border-slate-100 pb-5 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Package amount</dt><dd className="font-bold">{formatBookingMoney(quote.amounts.package, quote.currency)}</dd></div>{quote.amounts.sale_discount > 0 ? <div className="flex justify-between text-emerald-700"><dt>Tripanza sale</dt><dd className="font-bold">− {formatBookingMoney(quote.amounts.sale_discount, quote.currency)}</dd></div> : null}{quote.amounts.group_discount > 0 ? <div className="flex justify-between text-emerald-700"><dt>Group discount</dt><dd className="font-bold">− {formatBookingMoney(quote.amounts.group_discount, quote.currency)}</dd></div> : null}{quote.amounts.extras > 0 ? <div className="flex justify-between"><dt className="text-slate-500">Add-ons</dt><dd className="font-bold">{formatBookingMoney(quote.amounts.extras, quote.currency)}</dd></div> : null}{quote.amounts.tax > 0 ? <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="font-bold">{formatBookingMoney(quote.amounts.tax, quote.currency)}</dd></div> : null}</dl>
            <div className="mt-5 flex items-end justify-between"><span className="text-sm font-bold text-slate-600">Trip total</span><strong className="text-2xl font-black text-slate-950">{formatBookingMoney(quote.amounts.grand_total, quote.currency)}</strong></div>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-xs"><span className="text-slate-500">Pay now<strong className="mt-1 block text-sm text-slate-950">{formatBookingMoney(quote.amounts.pay_now, quote.currency)}</strong></span><span className="text-slate-500">Pay later<strong className="mt-1 block text-sm text-slate-950">{formatBookingMoney(quote.amounts.pay_later, quote.currency)}</strong></span></div>
            {unavailable ? <button disabled className="mt-5 min-h-14 w-full rounded-2xl bg-slate-300 text-sm font-black text-white">Checkout unavailable</button> : <Link href="/checkout" className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700">Continue to checkout →</Link>}
            <Link href={`/tours/${quote.tour.slug}`} className="mt-4 block text-center text-sm font-bold text-slate-500">Back to tour</Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
