"use client";

import { useEffect, useState } from "react";
import BookingHistory from "@/components/booking/BookingHistory";
import BookingHistoryLoading from "@/components/booking/BookingHistoryLoading";
import type { UserBooking } from "@/lib/wp";

const ACCOUNT_CACHE_KEY = "tripanza_account_cache_v1";
const ACCOUNT_CACHE_TTL = 55 * 60 * 1000;

type StoredAccount = {
  savedAt?: number;
  account?: {
    authenticated?: boolean;
    bookings?: UserBooking[];
    [key: string]: unknown;
  };
};

function readStoredBookings() {
  try {
    const stored = window.sessionStorage.getItem(ACCOUNT_CACHE_KEY);
    if (!stored) return null;
    const cached = JSON.parse(stored) as StoredAccount;
    if (!cached.savedAt || Date.now() - cached.savedAt > ACCOUNT_CACHE_TTL) return null;
    return cached.account?.authenticated && Array.isArray(cached.account.bookings)
      ? cached.account.bookings
      : null;
  } catch {
    return null;
  }
}

function updateStoredBookings(bookings: UserBooking[]) {
  try {
    const stored = window.sessionStorage.getItem(ACCOUNT_CACHE_KEY);
    if (!stored) return;
    const cached = JSON.parse(stored) as StoredAccount;
    if (!cached.account?.authenticated) return;
    cached.account.bookings = bookings;
    cached.savedAt = Date.now();
    window.sessionStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // A fresh response still renders if browser storage is unavailable.
  }
}

export default function DashboardBookings() {
  const [bookings, setBookings] = useState<UserBooking[] | null>(null);

  useEffect(() => {
    let active = true;
    const cached = readStoredBookings();
    const cacheFrame = cached?.length ? window.requestAnimationFrame(() => {
      if (active) setBookings(cached);
    }) : 0;

    fetch("/api/account/bookings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Bookings refresh failed");
        return response.json() as Promise<{ bookings?: UserBooking[] }>;
      })
      .then((payload) => {
        if (!active) return;
        if (cacheFrame) window.cancelAnimationFrame(cacheFrame);
        const fresh = Array.isArray(payload.bookings) ? payload.bookings : [];
        updateStoredBookings(fresh);
        setBookings(fresh);
      })
      .catch(() => {
        if (active && !cached?.length) setBookings([]);
      });

    return () => {
      active = false;
      if (cacheFrame) window.cancelAnimationFrame(cacheFrame);
    };
  }, []);

  return bookings === null ? <BookingHistoryLoading /> : <BookingHistory bookings={bookings} />;
}
