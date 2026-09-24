import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getUserBookings } from "@/lib/wp";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ bookings: [] }, { status: 401 });

  const bookings = await getUserBookings(token);
  return NextResponse.json(
    { bookings },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
