import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getUserAccount, getUserBookings, getUserProfile, getUserWallet } from "@/lib/wp";

export const dynamic = "force-dynamic";

const emptyWallet = {
  currency: "INR",
  balance: 0,
  source_balances: { cashback: 0, commission: 0, general: 0 },
  stats: { earned: 0, used: 0, movements: 0 },
  transactions: [],
};

export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({
      authenticated: false,
      profile: null,
      wallet: emptyWallet,
      bookings: [],
    });
  }

  const [profile, account, wallet, bookings] = await Promise.all([
    getUserProfile(token),
    getUserAccount(token),
    getUserWallet(token),
    getUserBookings(token),
  ]);

  if (!profile && !account) {
    return NextResponse.json({
      authenticated: false,
      profile: null,
      wallet: emptyWallet,
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
      phone: profile?.phone || "",
      state: profile?.state || "",
      dob: profile?.dob || "",
      gender: profile?.gender || "",
      cover: profile?.cover_url || "",
    },
    wallet: wallet || account?.wallet || emptyWallet,
    bookings,
  });
}
