import { getSessionToken } from "@/lib/session";

const upstream = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");
const allowed = new Set([
  "registration/send-code", "registration/verify-code", "registration", "me", "media", "trips",
  "bookings", "bookings/adjustment", "payout", "reels",
]);

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const relative = path.join("/");
  if (!allowed.has(relative) && !/^reels\/\d+$/.test(relative)) return Response.json({ error: "Not found." }, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const token = await getSessionToken();
  if (!token) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const isForm = request.headers.get("content-type")?.includes("multipart/form-data") || false;
  const headers: HeadersInit = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  let body: FormData | string | undefined;
  if (request.method !== "GET" && request.method !== "DELETE") {
    if (isForm) body = await request.formData();
    else { headers["Content-Type"] = "application/json"; body = await request.text(); }
  }
  try {
    const response = await fetch(`${upstream}/wp-json/tripanza-headless/v1/host/${relative}`, {
      method: request.method, headers, body, cache: "no-store",
    });
    const data = await response.json().catch(() => ({ error: "Host service returned an invalid response." }));
    return Response.json(data, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Host service is unavailable. Please try again." }, { status: 503 });
  }
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
