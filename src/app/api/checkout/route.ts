import { after, NextResponse } from "next/server";
import { featureUnavailable } from "@/lib/feature-access";
import { journeyIdFromRequest, recordJourney } from "@/lib/journey";
import {
  BookingApiError,
  clearBookingCart,
  createWordPressBooking,
  getBookingCart,
  requestBookingQuote,
  setBookingCart,
  type BookingTraveller,
  type CheckoutContact,
} from "@/lib/booking";
import { getSessionToken } from "@/lib/session";

type CheckoutPayload = {
  contact: CheckoutContact;
  travellers: BookingTraveller[];
  payment_method: "payu" | "upi";
  idempotency_key: string;
  quote_id: string;
  use_wallet?: boolean;
  wallet_amount?: number;
};

export async function POST(request: Request) {
  const unavailable = await featureUnavailable("new_bookings_enabled");
  if (unavailable) return unavailable;
  const cart = await getBookingCart();
  if (!cart) return NextResponse.json({ error: "Your booking cart is empty." }, { status: 409 });

  try {
    const payload = (await request.json()) as CheckoutPayload;
    const sessionToken = await getSessionToken();
    const quote = await requestBookingQuote(cart.selection, sessionToken);
    await setBookingCart({ ...cart, quote, updated_at: new Date().toISOString() });
    const booking = await createWordPressBooking({ ...cart.selection, ...payload }, sessionToken);
    await clearBookingCart();
    const visitorId = journeyIdFromRequest(request);
    if (visitorId) after(() => recordJourney({ visitor_id: visitorId, event: "booking_created", phone: payload.contact.phone }));
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof BookingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Secure checkout could not be started." }, { status: 400 });
  }
}
