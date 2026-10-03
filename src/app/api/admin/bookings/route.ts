import { requestAdminBookings } from "@/lib/admin-bookings";
import { ADMIN_NO_STORE } from "@/lib/admin-dashboard";
import { BOOKING_ACTIONS } from "@/lib/admin-bookings-types";
import { validRequestOrigin } from "@/lib/request-origin";
import { getSessionToken } from "@/lib/session";
export const maxDuration = 65;
async function relay(page: number, payload?: Record<string, unknown>) {
  const response = await requestAdminBookings(page, payload);
  return Response.json(await response.json().catch(() => ({ message: "Update Tripanza Native Admin API to v2.1.0 in WordPress." })), { status: response.status, headers: ADMIN_NO_STORE });
}
export async function GET(request: Request) {
  const page = Number(new URL(request.url).searchParams.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return Response.json({ message: "Invalid page." }, { status: 400, headers: ADMIN_NO_STORE });
  return relay(page);
}
export async function POST(request: Request) {
  const fail = (message: string, status: number) => Response.json({ message }, { status, headers: ADMIN_NO_STORE });
  if (!validRequestOrigin(request)) return fail("Invalid request origin.", 403);
  if (!await getSessionToken()) return fail("Please sign in.", 401);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail("JSON is required.", 415);
  if (Number(request.headers.get("content-length") || 0) > 20000) return fail("Request too large.", 413);
  let payload;
  try { const text = await request.text(); if (text.length > 20000) return fail("Request too large.", 413); payload = JSON.parse(text); }
  catch { return fail("Invalid JSON.", 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !BOOKING_ACTIONS.includes(payload.action)) return fail("Action not allowed.", 400);
  return relay(1, payload);
}
