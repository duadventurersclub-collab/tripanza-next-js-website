import { NextResponse } from "next/server";
import { BookingApiError, submitUpiPayment } from "@/lib/booking";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { booking_id: number; token: string; transaction_id: string; transaction_date: string };
    const result = await submitUpiPayment(payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BookingApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "The UPI reference could not be submitted." }, { status: 400 });
  }
}
