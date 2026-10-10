import { NextResponse } from "next/server";
import { setBookingCart, type BookingSelection } from "@/lib/booking";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  if (!body || typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) {
    return NextResponse.json({ error: "Invalid booking link." }, { status: 400 });
  }
  const secret = process.env.TRIPANZA_JOURNEY_SECRET;
  if (!secret) return NextResponse.json({ error: "Booking recovery is unavailable." }, { status: 503 });
  const wordpress = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");
  try {
    const response = await fetch(`${wordpress}/wp-json/tripanza-journey/v1/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tripanza-Journey-Secret": secret },
      body: JSON.stringify({ token: body.token }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return NextResponse.json({ error: "This booking link has expired or has already been used." }, { status: 410 });
    const data = await response.json() as { selection?: BookingSelection };
    const selection = data.selection;
    const counts = selection?.counts;
    if (!selection || !Number.isSafeInteger(selection.tour_id) || selection.tour_id < 1
      || !/^\d{4}-\d{2}-\d{2}$/.test(selection.date)
      || !counts || ![counts.quad, counts.triple, counts.twin].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 30)
      || counts.quad + counts.triple + counts.twin < 1 || !Array.isArray(selection.extras) || selection.extras.length > 30
      || !selection.extras.every(extra => typeof extra.name === "string" && extra.name.length <= 100 && Number.isSafeInteger(extra.quantity) && extra.quantity >= 0 && extra.quantity <= 30)) {
      return NextResponse.json({ error: "The saved trip is no longer valid." }, { status: 410 });
    }
    await setBookingCart({ selection, updated_at: new Date().toISOString() });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not restore your booking. Please try again." }, { status: 502 });
  }
}
