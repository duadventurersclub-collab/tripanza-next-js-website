import "server-only";
import { randomUUID } from "node:crypto";
import { getSessionToken } from "./session";
import { wordpressOrigin } from "./site-settings";
import { ADMIN_NO_STORE } from "./admin-dashboard";
export async function requestBookingEditor(id: number, payload?: Record<string, unknown>, search?: string) {
  const token = await getSessionToken();
  if (!token) return Response.json({ message: "Please sign in." }, { status: 401, headers: ADMIN_NO_STORE });
  const url = new URL(`${wordpressOrigin}/wp-json/tripanza-headless/v1/admin/bookings/${id}/editor`);
  url.searchParams.set("_tripanza_live", randomUUID()); if (search !== undefined) url.searchParams.set("search", search);
  try { return await fetch(url, { method: payload ? "POST" : "GET", body: payload ? JSON.stringify(payload) : undefined, cache: "no-store", redirect: "manual", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Cache-Control": "no-cache, no-store", ...(payload ? { "Content-Type": "application/json" } : {}) }, signal: AbortSignal.timeout(payload ? 60000 : 30000) }); }
  catch { return Response.json({ message: "WordPress is unavailable. Your changes have not been confirmed. Retry the same save or refresh to check the saved record." }, { status: 503, headers: ADMIN_NO_STORE }); }
}
