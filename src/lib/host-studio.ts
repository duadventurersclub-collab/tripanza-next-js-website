import { getSessionToken } from "@/lib/session";

export type StudioScreen = "posters" | "trips";
export type StudioDocument = { html: string; error?: string; redirect?: string };
const upstream = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");
const queryKeys = ["tour_id", "tab", "updated", "is_draft", "media_upload_error", "admin_tour_updated", "admin_tour_id"];

export function studioSearch(query: Record<string, string | string[] | undefined> | URLSearchParams) {
  const result = new URLSearchParams();
  for (const key of queryKeys) {
    const value = query instanceof URLSearchParams ? query.get(key) : query[key];
    if (typeof value === "string") result.set(key, value);
  }
  return result;
}

export function studioPath(screen: StudioScreen) {
  return screen === "posters" ? "/poster-download" : "/add-your-own-trip";
}

export function studioRedirect(location: string, screen: StudioScreen) {
  try {
    const url = new URL(location, upstream);
    if (url.origin !== new URL(upstream).origin) return null;
    if (![studioPath(screen), `${studioPath(screen)}/`, "/"].includes(url.pathname)) return null;
    const query = studioSearch(url.searchParams).toString();
    return studioPath(screen) + (query ? `?${query}` : "");
  } catch { return null; }
}

export function studioHTML(html: string, screen: StudioScreen, query: URLSearchParams) {
  const endpoint = `/api/host/studio/${screen}${query.size ? `?${query}` : ""}`;
  const config = JSON.stringify({ endpoint, page: studioPath(screen) }).replace(/</g, "\\u003c");
  // Styles/scripts run in an isolated document so the original selectors,
  // datepicker, native upload previews and all prompt templates remain intact.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Tripanza Host Studio</title><style>html,body{margin:0;min-height:100%;}body{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}</style><script>window.TRIPANZA_STUDIO=${config};</script><script src="/host-studio-bridge.js"></script></head><body>${html}</body></html>`;
}

export async function requestStudio(screen: StudioScreen | "tools", query: URLSearchParams, options: { method?: string; body?: FormData | string; contentType?: string } = {}) {
  const token = await getSessionToken();
  if (!token) return new Response(JSON.stringify({ success: false, data: "Please sign in first." }), { status: 401, headers: { "Content-Type": "application/json" } });
  const url = new URL(`${upstream}/`);
  url.searchParams.set("tripanza_host_studio", screen);
  for (const [key, value] of studioSearch(query)) url.searchParams.set(key, value);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "text/html, application/json", "Cache-Control": "no-cache" };
  if (options.contentType) headers["Content-Type"] = options.contentType;
  return fetch(url, {
    method: options.method || "GET", headers, body: options.body,
    redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(100_000),
  });
}

export async function getStudioDocument(screen: StudioScreen, query: Record<string, string | string[] | undefined>): Promise<StudioDocument> {
  const search = studioSearch(query);
  try {
    const response = await requestStudio(screen, search);
    if (response.headers.get("X-Tripanza-Studio") !== "1") return { html: "", error: "The Host Studio is being updated. Please try again shortly." };
    if (response.status >= 300 && response.status < 400) {
      const redirect = studioRedirect(response.headers.get("location") || "", screen);
      return { html: "", ...(redirect ? { redirect } : { error: "The studio session expired. Sign in again." }) };
    }
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      const data = await response.json().catch(() => null);
      return { html: "", error: typeof data?.data === "string" ? data.data : "The Host Studio could not load. Please try again." };
    }
    return { html: studioHTML(await response.text(), screen, search) };
  } catch { return { html: "", error: "The Host Studio could not connect. Please try again." }; }
}
