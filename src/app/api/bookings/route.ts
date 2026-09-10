import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // The WordPress API endpoint
    const wpEndpoint = `${process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com"}/wp-json/tripanza-app/v1/bookings`;

    const response = await fetch(wpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying booking request:", error);
    return NextResponse.json({ error: "Failed to process booking" }, { status: 500 });
  }
}
