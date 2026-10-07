import { NextResponse } from "next/server";
import { journeyIdFromRequest } from "@/lib/journey";
import { getSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { phone?: unknown } | null;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  if (phone.replace(/\D/g, "").length < 10 || phone.length > 50) {
    return NextResponse.json({ state: "disabled" }, { headers: { "Cache-Control": "no-store" } });
  }
  const secret = process.env.TRIPANZA_JOURNEY_SECRET;
  if (!secret) return NextResponse.json({ error: "Follow-up preferences are unavailable." }, { status: 503 });
  const origin = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");
  const sessionToken = await getSessionToken();
  try {
    const response = await fetch(`${origin}/wp-json/tripanza-journey/v1/preference`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tripanza-Journey-Secret": secret,
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({ phone, visitor_id: journeyIdFromRequest(request) }),
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) throw new Error("Preference lookup failed");
    const data = await response.json() as { state?: unknown };
    const state = data.state === "enabled" || data.state === "opted_out" ? data.state : "disabled";
    return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Follow-up preferences are unavailable." }, { status: 503 });
  }
}
