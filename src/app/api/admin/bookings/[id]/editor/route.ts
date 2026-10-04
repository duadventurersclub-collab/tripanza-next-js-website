import { requestBookingEditor } from "@/lib/admin-booking-editor";
import { EDITOR_ACTIONS } from "@/lib/admin-booking-editor-types";
import { ADMIN_NO_STORE } from "@/lib/admin-dashboard";
import { validRequestOrigin } from "@/lib/request-origin";
import { getSessionToken } from "@/lib/session";
export const maxDuration = 65;
type Context = { params: Promise<{ id: string }> };
const fail = (message: string, status: number) => Response.json({ message }, { status, headers: ADMIN_NO_STORE });
const bookingId = (value: string) => /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : 0;
async function relay(id: number, payload?: Record<string, unknown>, search?: string) {
  const response = await requestBookingEditor(id, payload, search);
  const status = response.status >= 300 && response.status < 400 ? 502 : response.status;
  return Response.json(await response.json().catch(() => ({ message: "Update Tripanza Native Admin API to v2.2.0 in WordPress." })), { status, headers: ADMIN_NO_STORE });
}
export async function GET(request: Request, context: Context) {
  const id = bookingId((await context.params).id); if (!id) return fail("Invalid booking ID.", 400);
  const search = new URL(request.url).searchParams.get("search"); if (search !== null && (search.trim().length < 2 || search.length > 100)) return fail("Search must contain 2–100 characters.", 400);
  return relay(id, undefined, search === null ? undefined : search.trim());
}
export async function POST(request: Request, context: Context) {
  if (!validRequestOrigin(request)) return fail("Invalid request origin.", 403);
  if (!await getSessionToken()) return fail("Please sign in.", 401);
  const id = bookingId((await context.params).id); if (!id) return fail("Invalid booking ID.", 400);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail("JSON is required.", 415);
  if (Number(request.headers.get("content-length") || 0) > 256000) return fail("Request too large.", 413);
  let payload;
  try { const raw = await request.text(); if (raw.length > 256000) return fail("Request too large.", 413); payload = JSON.parse(raw); } catch { return fail("Invalid JSON.", 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !EDITOR_ACTIONS.includes(payload.action)) return fail("Action not allowed.", 400);
  return relay(id, payload);
}
