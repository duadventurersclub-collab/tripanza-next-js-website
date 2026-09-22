import { NextResponse } from "next/server";
import {
  BookingApiError,
  createWordPressBooking,
  getBookingCart,
  requestBookingQuote,
  setBookingCart,
  type BookingTraveller,
  type CheckoutContact,
} from "@/lib/booking";

type CheckoutPayload = {
  contact: CheckoutContact;
  travellers: BookingTraveller[];
  payment_method: "payu" | "upi";
  idempotency_key: string;
};

export async function POST(request: Request) {
  const cart = await getBookingCart();
  if (!cart) return NextResponse.json({ error: "Your booking cart is empty." }, { status: 409 });

  try {
    const payload = (await request.json()) as CheckoutPayload;
    const quote = await requestBookingQuote(cart.selection);
    await setBookingCart({ ...cart, quote, updated_at: new Date().toISOString() });
    const booking = await createWordPressBooking({ ...cart.selection, ...payload });
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof BookingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Secure checkout could not be started." }, { status: 400 });
  }
}
