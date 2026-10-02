import { getSessionToken } from "./session";
import { wordpressOrigin } from "./site-settings";

export async function adminRequest(path: "settings" | "cache", body?: unknown) {
  const token = await getSessionToken();
  if (!token) return Response.json({ message: "Please sign in." }, { status: 401 });
  try {
    return await fetch(`${wordpressOrigin}/wp-json/tripanza-headless/v1/admin/${path}`, {
      method: body === undefined ? "GET" : "POST", cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60_000),
    });
  } catch { return Response.json({ message: "WordPress could not connect. No changes confirmed." }, { status: 503 }); }
}
