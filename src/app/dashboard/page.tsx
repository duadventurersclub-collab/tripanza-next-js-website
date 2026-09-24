import type { Metadata } from "next";
import DashboardBookings from "@/components/booking/DashboardBookings";

export const metadata: Metadata = {
  title: "Your Bookings | Tripanza",
};

export default function DashboardPage() {
  return <DashboardBookings />;
}
