import { adminRequest } from "@/lib/admin-settings";
import { liveSettingsUrl, LIVE_SETTINGS_HEADERS, wordpressOrigin } from "@/lib/site-settings";
import { version } from "next/package.json";

export async function GET() {
  const start = performance.now();
  // Authorize before diagnostics; never expose operational details publicly.
  const response = await adminRequest("operations");
  const data = await response.json().catch(() => ({ message: "Invalid operations response." }));
  if (!response.ok) return Response.json(data, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
  const responseMs = Math.round(performance.now() - start);
  const results = await Promise.allSettled([
    fetch(`${wordpressOrigin}/wp-json/tripanza-headless/v1/settings/public`, { cache: "no-store", signal: AbortSignal.timeout(5000) }),
    fetch(liveSettingsUrl("settings/public"), { cache: "no-store", headers: LIVE_SETTINGS_HEADERS, signal: AbortSignal.timeout(5000) }),
    adminRequest("settings"),
  ]);
  const responses = results.map(result => result.status === "fulfilled" ? result.value : null);
  const payloads = await Promise.all(responses.map(result => result?.ok ? result.json().catch(() => null) : null));
  const saved = payloads[2]?.settings?.revision;
  data.diagnostics = {
    response_ms: responseMs, upstream_cache: responses[0]?.headers.get("cf-cache-status") || responses[0]?.headers.get("x-litespeed-cache") || "Not reported",
    upstream_age: responses[0]?.headers.get("age") || "Not reported",
    stale_settings: payloads[0]?.revision && saved ? payloads[0].revision !== saved : null,
    public_revision: payloads[1]?.revision || null, saved_revision: saved || "Unavailable",
    next_version: version, monitoring_configured: (process.env.TRIPANZA_MONITORING_SECRET || "").length >= 32,
  };
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
