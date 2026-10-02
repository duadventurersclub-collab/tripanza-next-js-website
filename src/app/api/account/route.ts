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

  // WordPress /account already includes the profile, wallet and bookings.
  // Only use the separate endpoints for older installations without that payload.
  const account = await getUserAccount(token);
  const [profile, wallet, bookings] = await Promise.all([
    account?.profile ? Promise.resolve(account.profile) : getUserProfile(token),
    account?.wallet ? Promise.resolve(account.wallet) : getUserWallet(token),
    account?.bookings ? Promise.resolve(account.bookings) : getUserBookings(token),
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
    admin: account?.roles?.includes("administrator") || false,
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
