import { headers } from "next/headers";
import Link from "next/link";
import QRCode from "qrcode";
import PaymentExperience from "@/components/booking/PaymentExperience";
import { requestPaymentSession } from "@/lib/booking";

export const dynamic = "force-dynamic";

function ErrorPage({ message }: { message: string }) {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5"><div className="max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-2xl text-red-700">!</span><h1 className="mt-5 text-3xl font-black text-slate-950">Payment unavailable</h1><p className="mt-3 text-sm leading-6 text-slate-600">{message}</p><Link href="/checkout" className="mt-6 inline-flex rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white">Return to checkout</Link></div></main>;
}

export default async function PaymentPage({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<{ token?: string; method?: string }> }) {
  const [{ bookingId }, query, requestHeaders] = await Promise.all([params, searchParams, headers()]);
  const booking_id = Number(bookingId);
  const token = query.token || "";
  const method = query.method === "upi" ? "upi" : "payu";
  if (!Number.isInteger(booking_id) || booking_id < 1 || !token) return <ErrorPage message="This secure payment link is incomplete." />;

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL;
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "tripanza-next-js-website.onrender.com";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = (configuredOrigin || `${protocol}://${host}`).replace(/\/$/, "");

  let session;
  let qrDataUrl: string | undefined;
  let loadError = "";
  try {
    session = await requestPaymentSession({ booking_id, token, method, callback_url: `${origin}/api/payment/payu/callback` });
    qrDataUrl = session.method === "upi" ? await QRCode.toDataURL(session.upi.payment_url, { width: 420, margin: 2, errorCorrectionLevel: "M", color: { dark: "#151722", light: "#ffffff" } }) : undefined;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "This booking could not be prepared for payment.";
  }
  if (!session) return <ErrorPage message={loadError} />;
  return <PaymentExperience session={session} token={token} qrDataUrl={qrDataUrl} />;
}
