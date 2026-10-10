import { NextResponse } from "next/server";
import { validRequestOrigin } from "@/lib/request-origin";
import { setSessionCookie } from "@/lib/session";
import { wordpressOrigin } from "@/lib/site-settings";

const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  if (process.env.NODE_ENV === "production" && !wordpressOrigin.startsWith("https://")) return NextResponse.json({ error: "Secure admin sign-in is not configured." }, { status: 503, headers });
  if (Number(request.headers.get("content-length") || 0) > 1024) return NextResponse.json({ error: "Invalid verification request." }, { status: 400, headers });
  const body = await request.json().catch(() => null);
  const challenge = typeof body?.challenge === "string" ? body.challenge : "";
  const code = typeof body?.code === "string" ? body.code : "";
  if (!/^[a-f0-9]{64}$/.test(challenge) || !/^[0-9]{8}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 8-digit code from your email." }, { status: 400, headers });
  }
  try {
    const response = await fetch(`${wordpressOrigin}/wp-json/tripanza-headless/v1/auth/admin/verify`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ challenge, code }), cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return NextResponse.json({ error: "That code is incorrect or expired. Start again if needed." }, { status: 401, headers });
    const data = await response.json().catch(() => null);
    if (typeof data?.session_token !== "string" || !/^[a-f0-9]{64}$/.test(data.session_token)) throw new Error("Invalid admin session");
    await setSessionCookie(data.session_token);
    return NextResponse.json({ success: true }, { headers });
  } catch {
    return NextResponse.json({ error: "Admin verification is temporarily unavailable. Please try again." }, { status: 503, headers });
  }
}
