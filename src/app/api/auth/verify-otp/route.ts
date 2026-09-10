import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and OTP are required" }, { status: 400 });
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

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.message || "Failed to verify OTP" }, { status: response.status });
    }

    // Success! Securely store the session token in an HTTP-only cookie
    if (data.session_token) {
      await setSessionCookie(data.session_token);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
