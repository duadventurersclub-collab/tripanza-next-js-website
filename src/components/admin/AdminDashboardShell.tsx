"use client";

import AdminDashboard from "./AdminDashboard";
import { useAdminSnapshot } from "./useAdminSnapshot";
import type { AdminWorkspace } from "@/lib/admin-dashboard-types";

function validWorkspace(value: unknown, userId: number): value is AdminWorkspace {
  const data = value as Partial<AdminWorkspace> | null;
  return data?.api_version === "2.0.0" && data.user?.id === userId && typeof data.user.name === "string" && typeof data.today === "string" && typeof data.nonce === "string" && Array.isArray(data.tasks) && Array.isArray(data.plans) && Array.isArray(data.holidays) && Array.isArray(data.bookings) && Array.isArray(data.tours) && typeof data.capabilities?.analytics === "boolean";
}

export default function AdminDashboardShell({ userId, wordpressOrigin }: { userId: number; wordpressOrigin: string }) {
  const { data, checking, live, refreshing, error, refresh, remember } = useAdminSnapshot(userId, "dashboard", "/api/admin/dashboard", validWorkspace);
  return <>
    {data && <div role="status" aria-live="polite" style={{ padding: "10px 24px", background: live ? "#edf8f1" : "#fff4df", color: "#273344" }}>
      {live ? refreshing ? "Updating dashboard in the background…" : "Dashboard is up to date." : error ? "Showing a saved dashboard snapshot. Editing is paused until live data loads." : "Showing a saved dashboard snapshot while live data loads…"}
      {error && <><span> {error}</span> <button type="button" onClick={() => void refresh()}>Retry</button></>}
    </div>}
    {data ? <AdminDashboard initial={data} wordpressOrigin={wordpressOrigin} readOnly={!live} onDataChange={live ? remember : undefined} /> : <main className="admin-loading" role="status"><span className="admin-loading-spinner" aria-hidden="true" /><p>{checking || refreshing ? "Loading live dashboard…" : error || "Dashboard is unavailable."}</p>{!checking && !refreshing && <button type="button" onClick={() => void refresh()}>Retry</button>}</main>}
  </>;
}
