import assert from "node:assert/strict";
import { createServer } from "node:http";
import { handleWhatsAppHttp } from "../server/whatsapp/http.mjs";
import { normalizeWhatsAppPhone } from "../server/whatsapp/runtime.mjs";

const token = "a".repeat(64);
const calls = [];
const wp = createServer((req, res) => {
  res.writeHead(req.headers.authorization === `Bearer ${token}` ? 200 : 403, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ id: 1, api_version: "2.0.0" }));
});
await new Promise(resolve => wp.listen(0, "127.0.0.1", resolve));
const wpOrigin = `http://127.0.0.1:${wp.address().port}`;
const runtime = {
  status: () => ({ notifications: { connected: true, qr_available: false, state: "connected" }, crm: { connected: false, qr_available: true, state: "scan_qr" } }),
  qr: kind => kind === "crm" ? "test-qr-code" : "",
  send: async (...args) => { calls.push(args); return { success: true, message: "Message sent" }; },
};
let active = true;
const app = createServer(async (req, res) => {
  if (!await handleWhatsAppHttp(req, res, { runtime: active ? runtime : null, apiKey: "secret-test-key", wordpressOrigin: wpOrigin, enabled: active, startupError: active ? "" : "Set TRIPANZA_WHATSAPP_API_KEY and WP_WEBHOOK_SECRET." })) {
    res.writeHead(404); res.end("Not found");
  }
});
await new Promise(resolve => app.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${app.address().port}`;
const adminHeaders = { Cookie: `tripanza_session=${token}` };

try {
  assert.equal(normalizeWhatsAppPhone("9876543210"), "919876543210");
  assert.equal(normalizeWhatsAppPhone("+91 98765 43210"), "919876543210");
  assert.equal(normalizeWhatsAppPhone("123"), "");
  assert.equal((await fetch(`${base}/api/whatsapp/status`)).status, 403);
  const status = await fetch(`${base}/api/whatsapp/status`, { headers: adminHeaders });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).bots.crm.state, "scan_qr");
  assert.equal((await fetch(`${base}/api/whatsapp/qr?bot=crm`)).status, 403);
  const qr = await fetch(`${base}/api/whatsapp/qr?bot=crm`, { headers: adminHeaders });
  assert.equal(qr.status, 200);
  assert.equal(qr.headers.get("content-type"), "image/png");
  assert.equal(qr.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal((await fetch(`${base}/api/whatsapp/qr?bot=notifications`, { headers: adminHeaders })).status, 404);
  assert.equal((await fetch(`${base}/api/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: "wrong", phone: "9876543210", message: "test" }) })).status, 401);
  const sent = await fetch(`${base}/api/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: "secret-test-key", bot: "crm", phone: "9876543210", message: "Hello" }) });
  assert.equal(sent.status, 200);
  assert.deepEqual(calls, [["crm", "9876543210", "Hello"]]);
  assert.equal((await fetch(`${base}/api/send`, { method: "POST", body: "x".repeat(65_537) })).status, 413);
  assert.equal((await fetch(`${base}/qr-crm`, { redirect: "manual" })).headers.get("location"), "/admin/whatsapp");
  active = false;
  const disabled = await fetch(`${base}/api/whatsapp/status`, { headers: adminHeaders });
  assert.equal(disabled.status, 503);
  assert.match((await disabled.json()).message, /WP_WEBHOOK_SECRET/);
  console.log("PASS: private QR/status, API-key send, fail-closed setup, request size, legacy QR redirects and phone normalization");
} finally {
  await new Promise(resolve => app.close(resolve));
  await new Promise(resolve => wp.close(resolve));
}
