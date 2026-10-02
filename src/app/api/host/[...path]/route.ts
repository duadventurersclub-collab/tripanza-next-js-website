import { getSessionToken } from "@/lib/session";
import { getSiteSettings } from "@/lib/site-settings";

const upstream = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");
const allowed = new Set([
  "registration/send-code", "registration/verify-code", "registration", "me", "media", "trips",
  "custom-trips", "bookings", "bookings/adjustment", "payout", "reels",
]);

function validRequestOrigin(request: Request) {
  const value = request.headers.get("origin");
  if (!value) return true;
  let origin: URL;
  try { origin = new URL(value); } catch { return false; }
  if (!["http:", "https:"].includes(origin.protocol)) return false;

  // Render and other reverse proxies may expose an internal request.url while
  // the browser sends the public site origin. Compare against the public host.
  const publicHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim();
  const publicProto = (request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "")).split(",")[0].trim();
  const candidates = [new URL(request.url).origin, process.env.NEXT_PUBLIC_SITE_URL, process.env.RENDER_EXTERNAL_URL];
  if (publicHost && (publicProto === "http" || publicProto === "https")) candidates.push(`${publicProto}://${publicHost}`);
  if (candidates.some(candidate => { try { return candidate && new URL(candidate).origin === origin.origin; } catch { return false; } })) return true;

  // Fetch Metadata is set by browsers, not page JavaScript. It covers proxies
  // that rewrite even the forwarded host before Next.js receives the request.
  return request.headers.get("sec-fetch-site") === "same-origin";
}

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const relative = path.join("/");
  if (!allowed.has(relative) && !/^reels\/\d+$/.test(relative)) return Response.json({ error: "Not found." }, { status: 404 });
  if (!validRequestOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!(await getSiteSettings()).host_enabled) return Response.json({ error: "The Host feature is currently disabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
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
