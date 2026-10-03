import { getSessionToken } from "./session";
import { LIVE_SETTINGS_HEADERS, liveSettingsUrl, wordpressOrigin } from "./site-settings";
import { reportOperationalError } from "./error-monitoring";

export async function adminRequest(path: "settings" | "cache" | "operations", body?: unknown) {
  const token = await getSessionToken();
  if (!token) return Response.json({ message: "Please sign in." }, { status: 401 });
  try {
    const url = body === undefined ? liveSettingsUrl(`admin/${path}`) : `${wordpressOrigin}/wp-json/tripanza-headless/v1/admin/${path}`;
    return await fetch(url, {
      method: body === undefined ? "GET" : "POST", cache: "no-store",
      headers: { ...LIVE_SETTINGS_HEADERS, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60_000),
    });
  } catch { await reportOperationalError("upstream_error", "settings"); return Response.json({ message: "WordPress could not connect. No changes confirmed." }, { status: 503 }); }
}
