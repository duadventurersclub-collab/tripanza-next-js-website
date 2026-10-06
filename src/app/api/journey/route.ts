import { NextResponse } from "next/server";
import { JOURNEY_COOKIE, journeyIdFromRequest, newJourneyId, recordJourney } from "@/lib/journey";

const events = new Set(["consent", "itinerary_downloaded", "checkout_started", "tour_view", "withdraw", "opt_out"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const event = typeof body?.event === "string" ? body.event : "";
  if (!events.has(event)) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  const existingId = journeyIdFromRequest(request);
  if (!existingId && event !== "consent") return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  const visitorId = existingId || newJourneyId();
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const tourId = Number(body?.tourId) || 0;
  if (event === "consent" && (body?.consent !== true || phone.replace(/\D/g, "").length < 10 || phone.length > 50)) {
    return NextResponse.json({ error: "A valid phone number and explicit consent are required." }, { status: 400 });
  }
  const ok = await recordJourney({ visitor_id: visitorId, event, phone, email, tour_id: tourId, source: body?.source });
  if (!ok) return NextResponse.json({ error: "Follow-up preferences are unavailable." }, { status: 503 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  if (!existingId) response.cookies.set(JOURNEY_COOKIE, visitorId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return response;
}
