import { requestStudio, studioHTML, studioRedirect, studioSearch } from "@/lib/host-studio";
import { validRequestOrigin } from "@/lib/request-origin";

export const maxDuration = 120;
const noStore = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

async function handle(request: Request, context: { params: Promise<{ screen: string }> }) {
  const { screen } = await context.params;
  if (screen !== "posters" && screen !== "trips" && screen !== "tools") return Response.json({ success: false, data: "Not found." }, { status: 404, headers: noStore });
  if (screen === "tools" && request.method !== "POST") return Response.json({ success: false, data: "Method not allowed." }, { status: 405, headers: noStore });
  if (!validRequestOrigin(request)) return Response.json({ success: false, data: "Invalid request origin." }, { status: 403, headers: noStore });
  const search = studioSearch(new URL(request.url).searchParams);
  try {
    const type = request.headers.get("content-type") || "";
    const body = request.method === "POST" ? (type.includes("multipart/form-data") ? await request.formData() : await request.text()) : undefined;
    const response = await requestStudio(screen, search, { method: request.method, body, contentType: typeof body === "string" ? type : undefined });
    if (response.headers.get("X-Tripanza-Studio") !== "1") return Response.json({ success: false, data: "The Host Studio is being updated. Please try again shortly." }, { status: 503, headers: noStore });
    if (response.status >= 300 && response.status < 400) {
      const redirect = screen === "tools" ? null : studioRedirect(response.headers.get("location") || "", screen);
      return Response.json(redirect ? { redirect } : { success: false, data: "The studio session expired. Sign in again." }, { status: redirect ? 200 : 401, headers: noStore });
    }
    if (response.headers.get("content-type")?.includes("application/json")) {
      const data = await response.json();
      return Response.json(data, { status: response.status, headers: noStore });
    }
    if (!response.ok || screen === "tools" || !response.headers.get("content-type")?.includes("text/html")) return Response.json({ success: false, data: "The studio could not complete this request." }, { status: response.ok ? 502 : response.status, headers: noStore });
    return new Response(studioHTML(await response.text(), screen, search), { headers: { ...noStore, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "frame-ancestors 'self'", "X-Frame-Options": "SAMEORIGIN" } });
  } catch {
    return Response.json({ success: false, data: "The Host Studio is unavailable. Please try again." }, { status: 503, headers: noStore });
  }
}

export const GET = handle;
export const POST = handle;
