import Link from "next/link";
import { getPaymentStatus } from "@/lib/booking";

export const dynamic = "force-dynamic";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<{ booking_id?: string; token?: string; state?: string }> }) {
  const query = await searchParams;
  const bookingId = Number(query.booking_id);
  const token = query.token || "";
  const requestedState = query.state;
  let status;
  try {
    status = await getPaymentStatus(bookingId, token);
  } catch {
    status = null;
  }

  const normalizedStatus = (status?.payment_status || "").toLowerCase().replaceAll(" ", "_");
  const success = requestedState === "success" && ["paid", "fully_paid", "complete", "completed"].includes(normalizedStatus);
  const pending = requestedState === "pending" || normalizedStatus === "pending_verification";
  const title = success ? "Payment successful" : pending ? "Payment submitted" : "Payment not completed";
  const description = success ? "Your advance payment has been verified and your booking is confirmed." : pending ? "We received your UPI reference and will confirm the booking after verification." : "Your booking is still safe. You can return to the payment screen and try again.";

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_8%_0,rgba(216,238,85,.24),transparent_28rem),radial-gradient(circle_at_95%_8%,rgba(49,87,213,.15),transparent_30rem),#f4f6fa] px-4 py-12">
      <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-center shadow-[0_26px_80px_rgba(26,35,66,.13)]">
        <div className="px-6 py-10 sm:px-12 sm:py-14">
          <span className={`mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] text-4xl text-white shadow-xl ${success ? "bg-emerald-600" : pending ? "bg-blue-600" : "bg-red-600"}`}>{success ? "✓" : pending ? "↻" : "!"}</span>
          <p className="mt-7 text-[10px] font-black uppercase tracking-[.18em] text-blue-600">{success ? "Payment received" : pending ? "Verification pending" : "Payment interrupted"}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-500">{description}</p>
          {status ? <dl className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left text-sm"><div className="flex justify-between gap-5 border-b border-slate-200 py-3"><dt className="text-slate-500">Booking</dt><dd className="font-black">#{status.booking_id}</dd></div><div className="flex justify-between gap-5 border-b border-slate-200 py-3"><dt className="text-slate-500">Trip</dt><dd className="max-w-[65%] text-right font-black">{status.tour_title}</dd></div><div className="flex justify-between gap-5 py-3"><dt className="text-slate-500">Advance</dt><dd className="font-black text-blue-700">{money(status.amount, status.currency)}</dd></div></dl> : null}
          <div className="mt-7 grid gap-3 sm:grid-cols-2">{!success && !pending && bookingId > 0 && token ? <Link href={`/payment/${bookingId}?token=${encodeURIComponent(token)}&method=payu`} className="flex min-h-13 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white">Try payment again</Link> : <Link href="/tours" className="flex min-h-13 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white">Explore more trips</Link>}<Link href="/" className="flex min-h-13 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-black text-slate-900">Return home</Link></div>
        </div>
        <p className="bg-lime-50 px-6 py-4 text-xs font-semibold text-lime-900">Payment responses are verified by WordPress before a booking status changes.</p>
      </section>
    </main>
  );
}
