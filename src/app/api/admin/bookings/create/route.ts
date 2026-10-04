import { requestBookingCreate } from "@/lib/admin-booking-create";
import { ADMIN_NO_STORE } from "@/lib/admin-dashboard";
import { validRequestOrigin } from "@/lib/request-origin";
import { getSessionToken } from "@/lib/session";
export const maxDuration = 65;
const fail = (message: string, status: number) => Response.json({ message }, { status, headers: ADMIN_NO_STORE });
async function relay(payload?: Record<string, unknown>) {
  const response = await requestBookingCreate(payload);
  return Response.json(await response.json().catch(() => ({ message: "The booking response could not be read. Retry the same request, not a new booking.", uncertain: Boolean(payload) })), { status: response.status >= 300 && response.status < 400 ? 502 : response.status, headers: ADMIN_NO_STORE });
}
export async function GET() { return relay(); }
export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return fail("Invalid request origin.", 403);
  if (!await getSessionToken()) return fail("Please sign in.", 401);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail("JSON is required.", 415);
  if (Number(request.headers.get("content-length") || 0) > 64000) return fail("Request too large.", 413);
  let payload;
  try { const raw = await request.text(); if (raw.length > 64000) return fail("Request too large.", 413); payload = JSON.parse(raw); } catch { return fail("Invalid JSON.", 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !["standard", "custom"].includes(payload.mode)) return fail("Choose a booking type.", 400);
  return relay(payload);
}
