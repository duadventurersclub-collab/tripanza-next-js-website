"use client";

import { useEffect, useState } from "react";
import BookingHistory from "@/components/booking/BookingHistory";
import BookingHistoryLoading from "@/components/booking/BookingHistoryLoading";
import type { UserBooking } from "@/lib/wp";
import { useSiteSettings } from "@/components/settings/SiteSettingsProvider";
import { readAccountCache, writeAccountCache } from "@/lib/browser-account-cache";
import type { SiteSettings } from "@/lib/site-settings-types";

type StoredAccount = {
    authenticated?: boolean;
    bookings?: UserBooking[];
    [key: string]: unknown;
};

function readStoredBookings(settings: Pick<SiteSettings, "cache_revision" | "browser_cache_seconds">) {
  const account = readAccountCache<StoredAccount>(settings);
  return Array.isArray(account?.bookings) ? account.bookings : null;
}

function updateStoredBookings(bookings: UserBooking[], settings: Pick<SiteSettings, "cache_revision" | "browser_cache_seconds">) {
  const account = readAccountCache<StoredAccount>(settings);
  if (account) writeAccountCache({ ...account, bookings }, settings);
}

export default function DashboardBookings() {
  const settings = useSiteSettings();
  const [bookings, setBookings] = useState<UserBooking[] | null>(null);

  useEffect(() => {
    let active = true;
    const cacheSettings = { cache_revision: settings.cache_revision, browser_cache_seconds: settings.browser_cache_seconds };
    const cached = readStoredBookings(cacheSettings);
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
        updateStoredBookings(fresh, cacheSettings);
        setBookings(fresh);
      })
      .catch(() => {
        if (active && !cached?.length) setBookings([]);
      });

    return () => {
      active = false;
      if (cacheFrame) window.cancelAnimationFrame(cacheFrame);
    };
  }, [settings.cache_revision, settings.browser_cache_seconds]);

  return bookings === null ? <BookingHistoryLoading /> : <BookingHistory bookings={bookings} />;
}
