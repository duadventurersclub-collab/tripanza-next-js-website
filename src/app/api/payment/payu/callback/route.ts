import { NextResponse } from "next/server";
import { verifyPayUPayment } from "@/lib/booking";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const bookingId = Number(url.searchParams.get("booking_id"));
  const token = url.searchParams.get("token") || "";
  const fields = await request.formData();
  const payload: Record<string, string> = {};
  fields.forEach((value, key) => {
    if (typeof value === "string") payload[key] = value;
  });

  let state = "failed";
  try {
    const result = await verifyPayUPayment({ booking_id: bookingId, token, payload });
    state = result.success ? "success" : "failed";
  } catch {
    state = "failed";
  }

  const resultUrl = new URL("/payment/result", request.url);
  resultUrl.searchParams.set("booking_id", String(bookingId));
  resultUrl.searchParams.set("token", token);
  resultUrl.searchParams.set("state", state);
  return NextResponse.redirect(resultUrl, 303);
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const resultUrl = new URL("/payment/result", request.url);
  resultUrl.searchParams.set("booking_id", url.searchParams.get("booking_id") || "");
  resultUrl.searchParams.set("token", url.searchParams.get("token") || "");
  resultUrl.searchParams.set("state", "failed");
  return NextResponse.redirect(resultUrl, 303);
}
