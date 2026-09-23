import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4}$/.test(otp)) {
      return NextResponse.json({ error: "A valid email and 4-digit OTP are required." }, { status: 400 });
    }

    const wpEndpoint = `${process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com"}/wp-json/tripanza-app/v1/otp/verify`;

    const response = await fetch(wpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ email, otp }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json({ error: data.message || data.error || "Failed to verify OTP." }, { status: response.status });
    }

    if (!data.session_token || typeof data.session_token !== "string") {
      return NextResponse.json({ error: "Login succeeded but no secure session was returned. Please try again." }, { status: 502 });
    }
    await setSessionCookie(data.session_token);

    return NextResponse.json({ user: data.user || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
