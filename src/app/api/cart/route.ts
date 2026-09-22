import { NextResponse } from "next/server";
import {
  BookingApiError,
  clearBookingCart,
  getBookingCart,
  requestBookingQuote,
  setBookingCart,
  type BookingSelection,
} from "@/lib/booking";

function normalizeBookingDate(value: string) {
  const input = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const numeric = input.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (numeric) {
    const [, day, month, year] = numeric;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, "0"),
    String(parsed.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

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
    const submitted = (await request.json()) as BookingSelection;
    const selection = { ...submitted, date: normalizeBookingDate(submitted.date || "") };
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
