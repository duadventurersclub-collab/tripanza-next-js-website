import { NextResponse } from "next/server";
import { getBookingCart } from "@/lib/booking";

export async function GET() {
  const cart = await getBookingCart();
  return NextResponse.json({ has_cart: Boolean(cart) }, { headers: { "Cache-Control": "no-store" } });
}
