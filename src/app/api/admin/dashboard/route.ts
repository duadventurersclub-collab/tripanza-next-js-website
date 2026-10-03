import { ADMIN_NO_STORE, requestAdminWorkspace } from "@/lib/admin-dashboard";
import { ADMIN_ACTIONS } from "@/lib/admin-dashboard-types";
import { getSessionToken } from "@/lib/session";
import { validRequestOrigin } from "@/lib/request-origin";
export const maxDuration = 60;
async function relay(payload?: Record<string, unknown>) {
  const upstream = await requestAdminWorkspace(payload);
  const data = await upstream.json().catch(() => ({ message: "Activate Tripanza Native Admin API v2.0.0 in WordPress." }));
  // The existing itinerary email module returns the WordPress AJAX envelope.
  const failed = data?.success === false;
  return Response.json(data, { status: failed && upstream.ok ? 400 : upstream.status, headers: ADMIN_NO_STORE });
}
export async function GET() { return relay(); }
export async function POST(request: Request) {
  const fail = (message: string, status: number) => Response.json({ message }, { status, headers: ADMIN_NO_STORE });
  if (!validRequestOrigin(request)) return fail("Invalid request origin.", 403);
  if (!await getSessionToken()) return fail("Please sign in.", 401);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail("JSON is required.", 415);
  if (Number(request.headers.get("content-length") || 0) > 16_384) return fail("Request too large.", 413);
  try {
    const text = await request.text();
    if (text.length > 16_384) return fail("Request too large.", 413);
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || !ADMIN_ACTIONS.includes(payload.action)) return fail("Action not allowed.", 400);
    return relay(payload);
  } catch { return fail("Invalid request.", 400); }
}
