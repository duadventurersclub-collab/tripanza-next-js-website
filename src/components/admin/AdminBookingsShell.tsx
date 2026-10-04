"use client";

import AdminBookings from "./AdminBookings";
import { useAdminSnapshot } from "./useAdminSnapshot";
import type { AdminBookingsData } from "@/lib/admin-bookings-types";

function validBookings(value: unknown): value is AdminBookingsData {
  const data = value as Partial<AdminBookingsData> | null;
  return data?.bookings_api_version === "1.0.0" && typeof data.user?.name === "string" && typeof data.today === "string" && Array.isArray(data.rows) && Array.isArray(data.archived) && typeof data.statuses === "object" && data.statuses !== null && typeof data.nonce === "string" && data.page === 1;
}

export default function AdminBookingsShell({ userId, wordpressOrigin }: { userId: number; wordpressOrigin: string }) {
  const { data, checking, live, refreshing, error, refresh, remember } = useAdminSnapshot(userId, "bookings", "/api/admin/bookings?page=1", validBookings);
  return <>
    {data && <div role="status" aria-live="polite" style={{ padding: "10px 24px", background: live ? "#edf8f1" : "#fff4df", color: "#273344" }}>
      {live ? refreshing ? "Updating bookings in the background…" : "Bookings are up to date." : error ? "Showing a saved booking snapshot. Editing is paused until live data loads." : "Showing saved bookings while live data loads…"}
      {error && <><span> {error}</span> <button type="button" onClick={() => void refresh()}>Retry</button></>}
    </div>}
    {data ? <AdminBookings initial={data} wordpressOrigin={wordpressOrigin} readOnly={!live} onDataChange={live ? remember : undefined} /> : <main className="admin-settings" role="status"><p className="as-eyebrow">TRIPANZA / BOOKINGS</p><h1>{checking || refreshing ? "Loading live booking history…" : "Booking history is unavailable."}</h1>{error && <p>{error}</p>}{!checking && !refreshing && <button type="button" onClick={() => void refresh()}>Retry</button>}</main>}
  </>;
}
