import { after, NextResponse } from "next/server";
import { featureUnavailable } from "@/lib/feature-access";
import { journeyIdFromRequest, recordJourney } from "@/lib/journey";
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
  const unavailable = await featureUnavailable("new_bookings_enabled");
  if (unavailable) return unavailable;
  try {
    const submitted = (await request.json()) as BookingSelection & { defer_quote?: boolean };
    const { defer_quote, ...details } = submitted;
    const selection = { ...details, date: normalizeBookingDate(details.date || "") };
    if (defer_quote === true) {
      const counts = selection.counts;
      if (!Number.isSafeInteger(selection.tour_id) || selection.tour_id < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(selection.date)
        || (selection.tour_slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(selection.tour_slug))
        || !counts || ![counts.quad, counts.triple, counts.twin].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 30)
        || counts.quad + counts.triple + counts.twin < 1 || !Array.isArray(selection.extras) || selection.extras.length > 30
        || !selection.extras.every(extra => typeof extra.name === "string" && extra.name.length <= 100 && Number.isSafeInteger(extra.quantity) && extra.quantity >= 0 && extra.quantity <= 30)) {
        return NextResponse.json({ error: "Choose a valid departure and number of travellers." }, { status: 400 });
      }
      const cart = { selection, updated_at: new Date().toISOString() };
      await setBookingCart(cart);
      const visitorId = journeyIdFromRequest(request);
      if (visitorId) after(() => recordJourney({ visitor_id: visitorId, event: "cart_created", tour_id: selection.tour_id, selection }));
      return NextResponse.json({ cart }, { status: 201 });
    }
    const quote = await requestBookingQuote(selection);
    const cart = { selection, quote, updated_at: new Date().toISOString() };
    await setBookingCart(cart);
    const visitorId = journeyIdFromRequest(request);
    if (visitorId) after(() => recordJourney({ visitor_id: visitorId, event: "cart_created", tour_id: selection.tour_id, selection }));
    return NextResponse.json({ cart }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to add this tour to your cart." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  await clearBookingCart();
  const visitorId = journeyIdFromRequest(request);
  if (visitorId) after(() => recordJourney({ visitor_id: visitorId, event: "cart_cleared" }));
  return new NextResponse(null, { status: 204 });
}
