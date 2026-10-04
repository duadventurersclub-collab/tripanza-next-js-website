import "server-only";
import { randomUUID } from "node:crypto";
import { getSessionToken } from "./session";
import { wordpressOrigin } from "./site-settings";
import { ADMIN_NO_STORE } from "./admin-dashboard";
export async function requestBookingCreate(payload?: Record<string, unknown>) {
  const token = await getSessionToken();
  if (!token) return Response.json({ message: "Please sign in." }, { status: 401, headers: ADMIN_NO_STORE });
  try { return await fetch(`${wordpressOrigin}/wp-json/tripanza-headless/v1/admin/bookings/create?_tripanza_live=${randomUUID()}`, { method: payload ? "POST" : "GET", body: payload ? JSON.stringify(payload) : undefined, cache: "no-store", redirect: "manual", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Cache-Control": "no-cache, no-store", ...(payload ? { "Content-Type": "application/json" } : {}) }, signal: AbortSignal.timeout(payload ? 60000 : 30000) }); }
  catch { return Response.json({ message: "WordPress could not confirm this request. Retry the same request to check its result; do not create another booking yet.", uncertain: Boolean(payload) }, { status: 503, headers: ADMIN_NO_STORE }); }
}
