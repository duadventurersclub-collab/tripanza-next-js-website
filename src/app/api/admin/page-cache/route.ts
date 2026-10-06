import { randomUUID } from "node:crypto";
import { adminRequest } from "@/lib/admin-settings";
import { cachePagePath, clearPublicPageCache, STATIC_CACHE_PAGES, type PublicCachePage } from "@/lib/page-cache";
import { validRequestOrigin } from "@/lib/request-origin";
import { wordpressOrigin } from "@/lib/site-settings";

export const runtime = "nodejs";
const PRIVATE = { "Cache-Control": "private, no-store" };

async function authorize() {
  const response = await adminRequest("settings");
  if (!response.ok) return Response.json({ message: response.status === 401 || response.status === 403 ? "Administrator access required." : "Could not verify administrator access." }, { status: response.status, headers: PRIVATE });
  return null;
}

export async function GET() {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const pages: PublicCachePage[] = [...STATIC_CACHE_PAGES];
    const seen = new Set(pages.map(page => page.path));
    for (let page = 1; page <= 200; page++) {
      const url = `${wordpressOrigin}/wp-json/tripanza-headless/v1/tours?per_page=100&page=${page}&_tripanza_live=${randomUUID()}`;
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000), headers: { Accept: "application/json", "Cache-Control": "no-cache, no-store" } });
      if (!response.ok) throw new Error("Published trips could not be retrieved from WordPress.");
      const result = await response.json() as { items?: Array<{ slug?: unknown; title?: unknown }>; total_pages?: number };
      if (!Array.isArray(result.items) || typeof result.total_pages !== "number" || !Number.isInteger(result.total_pages)) throw new Error("The trip catalogue response was incomplete.");
      for (const tour of result.items) {
        const path = `/tours/${tour.slug}`;
        if (!cachePagePath(path) || seen.has(path)) continue;
        seen.add(path);
        pages.push({ path, title: typeof tour.title === "string" ? tour.title : path, kind: "tour" });
      }
      if (page >= result.total_pages) return Response.json({ pages }, { headers: PRIVATE });
    }
    throw new Error("The published trip list is too large to load in one operation.");
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Could not retrieve public pages." }, { status: 503, headers: PRIVATE });
  }
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403, headers: PRIVATE });
  const denied = await authorize();
  if (denied) return denied;
  let body: { paths?: unknown };
  try { body = await request.json(); } catch { return Response.json({ message: "Invalid JSON." }, { status: 400, headers: PRIVATE }); }
  if (!Array.isArray(body?.paths) || !body.paths.length || body.paths.length > 50) return Response.json({ message: "Choose 1–50 public pages per request." }, { status: 400, headers: PRIVATE });
  const paths = [...new Set(body.paths.map(cachePagePath))];
  if (paths.includes(null) || paths.length !== body.paths.length) return Response.json({ message: "Invalid or duplicate page path." }, { status: 400, headers: PRIVATE });
  for (const path of paths) clearPublicPageCache(path!);
  return Response.json({ ok: true, cleared: paths.length }, { headers: PRIVATE });
}
