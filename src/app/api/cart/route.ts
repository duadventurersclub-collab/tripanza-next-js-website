import { NextResponse } from "next/server";
import {
  BookingApiError,
  clearBookingCart,
  getBookingCart,
  requestBookingQuote,
  setBookingCart,
  type BookingSelection,
} from "@/lib/booking";

export async function GET() {
  const cart = await getBookingCart();
  if (!cart) return NextResponse.json({ cart: null });
  try {
    const quote = await requestBookingQuote(cart.selection);
    const refreshed = { ...cart, quote, updated_at: new Date().toISOString() };
    await setBookingCart(refreshed);
    return NextResponse.json({ cart: refreshed });
  } catch (error) {
    if (error instanceof BookingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to refresh the cart." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const selection = (await request.json()) as BookingSelection;
    const quote = await requestBookingQuote(selection);
    const cart = { selection, quote, updated_at: new Date().toISOString() };
    await setBookingCart(cart);
    return NextResponse.json({ cart }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to add this tour to your cart." }, { status: 400 });
  }
}

export async function DELETE() {
  await clearBookingCart();
  return new NextResponse(null, { status: 204 });
}
