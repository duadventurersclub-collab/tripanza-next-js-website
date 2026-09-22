import Link from "next/link";
import CheckoutForm from "@/components/booking/CheckoutForm";
import { getBookingCart, requestBookingQuote } from "@/lib/booking";
import { getTourById } from "@/lib/wp";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cart = await getBookingCart();
  if (!cart) {
    return <main className="min-h-screen bg-slate-50 px-5 py-20"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-3xl font-black text-slate-950">Your cart is empty</h1><p className="mt-3 text-slate-500">Add a tour before opening checkout.</p><Link href="/tours" className="mt-7 inline-flex rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white">Explore tours</Link></div></main>;
  }

  let quote;
  try {
    quote = await requestBookingQuote(cart.selection);
  } catch (error) {
    return <main className="min-h-screen bg-slate-50 px-5 py-20"><div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm"><h1 className="text-3xl font-black text-slate-950">Checkout needs attention</h1><p className="mt-3 text-red-700">{error instanceof Error ? error.message : "This fare is no longer available."}</p><Link href="/cart" className="mt-7 inline-flex rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white">Return to cart</Link></div></main>;
  }
  const tour = await getTourById(quote.tour.id);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.2em] text-blue-600">Secure checkout</p><h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Complete your booking</h1><p className="mt-2 text-sm text-slate-500">Traveller details and your preferred ST Tours payment method.</p></div><Link href="/cart" className="hidden text-sm font-bold text-slate-500 sm:block">← Back to cart</Link></div>
        <CheckoutForm quote={quote} requireGuestNames={tour?.details.booking.require_guest_names ?? true} />
      </div>
    </main>
  );
}
