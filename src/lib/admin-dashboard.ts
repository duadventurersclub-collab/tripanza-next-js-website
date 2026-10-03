import "server-only";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { getSessionToken } from "./session";
import { wordpressOrigin } from "./site-settings";
import { adminRequest } from "./admin-settings";

export const ADMIN_NO_STORE = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
export async function requestAdminWorkspace(payload?: Record<string, unknown>) {
  const token = await getSessionToken();
  if (!token) return Response.json({ message: "Please sign in." }, { status: 401, headers: ADMIN_NO_STORE });
  try {
    return await fetch(`${wordpressOrigin}/wp-json/tripanza-headless/v1/admin/workspace?_tripanza_live=${randomUUID()}`, {
      method: payload ? "POST" : "GET", body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store", redirect: "manual",
      headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache, no-store", Accept: "application/json", ...(payload ? { "Content-Type": "application/json" } : {}) },
      signal: AbortSignal.timeout(payload ? 45_000 : 15_000),
    });
  } catch { return Response.json({ message: "WordPress is unavailable. Please try again." }, { status: 503, headers: ADMIN_NO_STORE }); }
}
export const getAdminIdentity = cache(async () => {
  const token = await getSessionToken();
  if (!token) return { status: 401, name: "", available: false };
  try {
    const response = await fetch(`${wordpressOrigin}/wp-json/tripanza-headless/v1/admin/identity?_tripanza_live=${randomUUID()}`, {
      cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache, no-store" }, signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 404) {
      const fallback = await adminRequest("settings");
      return { status: fallback.status, name: "Administrator", available: false };
    }
    const data = await response.json().catch(() => null);
    return { status: response.status, name: typeof data?.name === "string" ? data.name : "Administrator", available: response.ok && data?.api_version === "2.0.0" };
  } catch { return { status: 503, name: "", available: false }; }
});
