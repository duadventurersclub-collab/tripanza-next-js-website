import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getUserAccount, getUserBookings, getUserProfile } from "@/lib/wp";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({
      authenticated: false,
      profile: null,
      wallet: { currency: "INR", balance: 0 },
      bookings: [],
    });
  }

  const [profile, account, bookings] = await Promise.all([
    getUserProfile(token),
    getUserAccount(token),
    getUserBookings(token),
  ]);

  if (!profile && !account) {
    return NextResponse.json({
      authenticated: false,
      profile: null,
      wallet: { currency: "INR", balance: 0 },
      bookings: [],
    });
  }

  return NextResponse.json({
    authenticated: true,
    profile: {
      id: profile?.id || account?.id || 0,
      name: profile?.display_name || account?.name || "Tripanza traveller",
      email: profile?.email || account?.email || "",
      avatar: profile?.avatar_url || account?.avatar || "",
    },
    wallet: account?.wallet || { currency: "INR", balance: 0 },
    bookings,
  });
}
