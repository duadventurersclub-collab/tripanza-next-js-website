import { adminRequest } from "@/lib/admin-settings";
import { invalidateAppCache } from "@/lib/cache-controls";
import { validRequestOrigin } from "@/lib/request-origin";

async function handle(request: Request) {
  if (request.method === "POST" && !validRequestOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  let body: unknown;
  if (request.method === "POST") {
    try { body = await request.json(); } catch { return Response.json({ message: "Invalid JSON." }, { status: 400 }); }
  }
  const response = await adminRequest("seo", body);
  const data = await response.json().catch(() => ({ message: "Invalid SEO response." }));
  if (response.ok && request.method === "POST") invalidateAppCache("all");
  return Response.json(data, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
}

export const GET = handle;
export const POST = handle;
