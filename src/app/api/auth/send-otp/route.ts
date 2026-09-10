import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const wpEndpoint = `${process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com"}/wp-json/tripanza-app/v1/otp/send`;

    const response = await fetch(wpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.message || "Failed to send OTP" }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error sending OTP:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
