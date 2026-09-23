import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";

type AuthResponse = {
  session_token?: unknown;
  token?: unknown;
  access_token?: unknown;
  user?: unknown;
  message?: string;
  error?: string;
  data?: AuthResponse;
  session?: { token?: unknown };
};

function readSessionToken(payload: AuthResponse) {
  const candidates = [
    payload.session_token,
    payload.token,
    payload.access_token,
    payload.session?.token,
    payload.data?.session_token,
    payload.data?.token,
    payload.data?.access_token,
    payload.data?.session?.token,
  ];
  return candidates.find((value): value is string => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value)) || "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const channel = body.channel === "whatsapp" ? "whatsapp" : "email";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const normalized = channel === "email" ? email.toLowerCase() : email;
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";
    const phoneDigits = normalized.replace(/\D/g, "");
    const validIdentity = channel === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) : phoneDigits.length >= 10 && phoneDigits.length <= 15;

    if (!validIdentity || !/^\d{4}$/.test(otp)) {
      return NextResponse.json({ error: `A valid ${channel === "whatsapp" ? "WhatsApp number" : "email"} and 4-digit OTP are required.` }, { status: 400 });
    }

    const wpEndpoint = `${process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com"}/wp-json/tripanza-headless/v1/auth/otp/verify`;

    const response = await fetch(wpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ email: normalized, channel, otp }),
    });

    const data = await response.json().catch(() => ({})) as AuthResponse;

    if (!response.ok) {
      return NextResponse.json({ error: data.message || data.error || "Failed to verify OTP." }, { status: response.status });
    }

    const sessionToken = readSessionToken(data);
    if (!sessionToken) {
      console.error("Tripanza OTP verified without a usable session token", {
        upstreamKeys: Object.keys(data),
        nestedKeys: data.data ? Object.keys(data.data) : [],
      });
      return NextResponse.json({ error: "Login succeeded but no secure session was returned. Please try again." }, { status: 502 });
    }
    await setSessionCookie(sessionToken);

    return NextResponse.json({ user: data.user || data.data?.user || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
