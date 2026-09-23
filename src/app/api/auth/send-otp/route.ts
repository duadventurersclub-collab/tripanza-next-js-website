import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const channel = body.channel === "whatsapp" ? "whatsapp" : "email";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const normalized = channel === "email" ? email.toLowerCase() : email;

    const phoneDigits = normalized.replace(/\D/g, "");
    const valid = channel === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) : phoneDigits.length >= 10 && phoneDigits.length <= 15;
    if (!valid) {
      return NextResponse.json({ error: channel === "whatsapp" ? "Enter a valid WhatsApp number with country code." : "Enter a valid email address." }, { status: 400 });
    }

    const wpEndpoint = `${process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com"}/wp-json/tripanza-app/v1/otp/send`;

    const response = await fetch(wpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ email: normalized, channel }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json({ error: data.message || data.error || "Failed to send OTP." }, { status: response.status });
    }

    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
