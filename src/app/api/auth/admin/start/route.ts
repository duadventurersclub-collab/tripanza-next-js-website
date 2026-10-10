import { NextResponse } from "next/server";
import { validRequestOrigin } from "@/lib/request-origin";
import { wordpressOrigin } from "@/lib/site-settings";

const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  if (process.env.NODE_ENV === "production" && !wordpressOrigin.startsWith("https://")) return NextResponse.json({ error: "Secure admin sign-in is not configured." }, { status: 503, headers });
  if (Number(request.headers.get("content-length") || 0) > 1024) return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400, headers });
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400, headers });
  }
  try {
    const response = await fetch(`${wordpressOrigin}/wp-json/tripanza-headless/v1/auth/admin/start`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email }), cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 429) return NextResponse.json({ error: "Please wait before requesting another code. Repeated requests may be limited for 15 minutes." }, { status: 429, headers });
    if (!response.ok) return NextResponse.json({ error: "Could not request a code. Please try again shortly." }, { status: 503, headers });
    const data = await response.json().catch(() => null);
    if (typeof data?.challenge !== "string" || !/^[a-f0-9]{64}$/.test(data.challenge)) throw new Error("Invalid admin challenge");
    return NextResponse.json({ challenge: data.challenge }, { headers });
  } catch {
    return NextResponse.json({ error: "Admin sign-in is temporarily unavailable. Please try again." }, { status: 503, headers });
  }
}
