import type { Metadata } from "next";
import ResumeBooking from "@/components/booking/ResumeBooking";

export const metadata: Metadata = { title: "Continue your booking", robots: { index: false, follow: false } };

export default function ResumeBookingPage() {
  return <ResumeBooking />;
}
