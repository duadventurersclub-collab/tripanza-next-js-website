import { NextResponse } from "next/server";

const WORDPRESS_URL = (
  process.env.WORDPRESS_URL ||
  process.env.NEXT_PUBLIC_WORDPRESS_URL ||
  "https://tripanza.com"
).replace(/\/$/, "");

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const tourId = Number(body?.tourId);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const phoneDigits = phone.replace(/\D/g, "");

  if (!Number.isSafeInteger(tourId) || tourId <= 0 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || phone.length > 50 || phoneDigits.length < 7 || phoneDigits.length > 15) {
    return NextResponse.json({ error: "Enter a valid email address and phone number." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const upstream = await fetch(`${WORDPRESS_URL}/wp-json/tripanza-headless/v1/itinerary-lead`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: tourId, email, phone }),
      cache: "no-store",
      signal: controller.signal,
    });
    const result = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

    if (!upstream.ok) {
      const error = upstream.status === 404
        ? "Itinerary requests are temporarily unavailable. Please try again soon."
        : typeof result.message === "string" ? result.message : "Your details could not be saved. Please try again.";
      return NextResponse.json({ error }, { status: upstream.status === 404 ? 503 : upstream.status });
    }

    return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { error: timedOut ? "Saving is taking too long. Please try again." : "Could not save your details right now. Please try again." },
      { status: timedOut ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
