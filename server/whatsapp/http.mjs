import { timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";

const noStore = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

function json(res, status, data) {
  res.writeHead(status, { ...noStore, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function equalSecret(expected, provided) {
  if (!expected || typeof provided !== "string") return false;
  const a = Buffer.from(expected), b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionToken(header) {
  const item = String(header || "").split(";").map(part => part.trim()).find(part => part.startsWith("tripanza_session="));
  if (!item) return "";
  try { return decodeURIComponent(item.slice("tripanza_session=".length)); } catch { return ""; }
}

async function adminAllowed(req, wordpressOrigin) {
  const token = sessionToken(req.headers.cookie);
  if (!/^[a-f0-9]{64}$/i.test(token)) return false;
  try {
    const headers = { Authorization: `Bearer ${token}`, "Cache-Control": "no-store", Accept: "application/json" };
    const base = wordpressOrigin.replace(/\/$/, "");
    const identity = await fetch(`${base}/wp-json/tripanza-headless/v1/admin/identity`, { cache: "no-store", redirect: "manual", headers, signal: AbortSignal.timeout(8000) });
    if (identity.status === 200) return true;
    if (identity.status !== 404) return false;
    const fallback = await fetch(`${base}/wp-json/tripanza-headless/v1/admin/settings`, { cache: "no-store", redirect: "manual", headers, signal: AbortSignal.timeout(8000) });
    return fallback.status === 200;
  } catch { return false; }
}

async function readJson(req, limit = 65_536) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("too_large");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("invalid_json"); }
}

export async function handleWhatsAppHttp(req, res, { runtime, apiKey, wordpressOrigin, enabled, startupError = "" }) {
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.pathname;
  if (path === "/qr-notifications" || path === "/qr-crm") {
    res.writeHead(307, { ...noStore, Location: "/admin/whatsapp" });
    res.end();
    return true;
  }
  if (path === "/api/send" && req.method === "POST") {
    let body;
    try { body = await readJson(req); }
    catch (error) { json(res, error.message === "too_large" ? 413 : 400, { success: false, error: "Invalid request body" }); return true; }
    if (!enabled || !runtime) { json(res, 503, { success: false, error: "WhatsApp engine is disabled" }); return true; }
    if (!equalSecret(apiKey, body?.api_key)) { json(res, 401, { success: false, error: "Invalid API key" }); return true; }
    const kind = body.bot === "crm" ? "crm" : "notifications";
    try { json(res, 200, await runtime.send(kind, body.phone, body.message)); }
    catch (error) {
      const status = /Invalid phone|Message must/.test(error.message) ? 400 : /not connected/.test(error.message) ? 503 : 502;
      json(res, status, { success: false, error: status === 502 ? "WhatsApp send failed" : error.message });
    }
    return true;
  }
  if (path !== "/api/whatsapp/status" && path !== "/api/whatsapp/qr") return false;
  if (req.method !== "GET") { json(res, 405, { error: "Method not allowed" }); return true; }
  if (!await adminAllowed(req, wordpressOrigin)) { json(res, 403, { error: "Administrator access required" }); return true; }
  if (!enabled || !runtime) { json(res, 503, { enabled: false, message: startupError || "Integrated WhatsApp engine is not enabled on this server." }); return true; }
  if (path === "/api/whatsapp/status") { json(res, 200, { enabled: true, bots: runtime.status() }); return true; }
  const kind = url.searchParams.get("bot");
  if (kind !== "crm" && kind !== "notifications") { json(res, 400, { error: "Choose a bot" }); return true; }
  const qr = runtime.qr(kind);
  if (!qr) { json(res, 404, { error: "QR unavailable; the bot may already be connected." }); return true; }
  const image = await QRCode.toBuffer(qr, { type: "png", width: 320, margin: 2 });
  res.writeHead(200, { ...noStore, "Content-Type": "image/png", "Content-Length": image.length });
  res.end(image);
  return true;
}
