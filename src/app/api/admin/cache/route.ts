import { adminRequest } from "@/lib/admin-settings";
import { invalidateAppCache } from "@/lib/cache-controls";
import { validRequestOrigin } from "@/lib/request-origin";
import type { CacheScope } from "@/lib/site-settings-types";

const scopes = new Set<CacheScope>(["all", "tours", "reels", "hosts", "site", "bookings", "browser", "pdf", "pdf_all", "page_cache"]);
export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ message: "Invalid JSON." }, { status: 400 }); }
  if (!body || !scopes.has(body.scope)) return Response.json({ message: "Invalid cache scope." }, { status: 400 });
  // WordPress verifies manage_options before any Next.js invalidation is run.
  const response = await adminRequest("cache", body);
  const data = await response.json().catch(() => ({ message: "Invalid cache response." }));
  if (response.ok && data.ok) invalidateAppCache(body.scope);
  return Response.json(data, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
}
