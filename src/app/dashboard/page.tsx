import type { Metadata } from "next";
import BookingHistory from "@/components/booking/BookingHistory";
import { getSessionToken } from "@/lib/session";
import { getUserBookings } from "@/lib/wp";

export const metadata: Metadata = {
  title: "Your Bookings | Tripanza",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const token = await getSessionToken();
  const bookings = token ? await getUserBookings(token) : [];
  return <BookingHistory bookings={bookings} />;
}
