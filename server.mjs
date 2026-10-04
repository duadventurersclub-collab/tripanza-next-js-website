import { createServer } from "node:http";
import { isAbsolute } from "node:path";
import next from "next";
import { handleWhatsAppHttp } from "./server/whatsapp/http.mjs";

const requested = process.env.TRIPANZA_WHATSAPP_ENABLED === "true";
const authDir = process.env.TRIPANZA_WHATSAPP_AUTH_DIR || "";
const apiKey = process.env.TRIPANZA_WHATSAPP_API_KEY || "";
const webhookSecret = process.env.WP_WEBHOOK_SECRET || "";
const webhookUrl = process.env.TRIPANZA_WHATSAPP_CRM_WEBHOOK_URL || "https://tripanza.com/wp-json/whatsapp-ai/v1/server-reply/";
const wordpressOrigin = process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com";
const persistentAuth = process.env.TRIPANZA_WHATSAPP_PERSISTENT_STORAGE_CONFIRMED === "yes";
const ephemeralAuth = process.env.TRIPANZA_WHATSAPP_ALLOW_EPHEMERAL_AUTH === "yes";
const freeKeepAwake = process.env.TRIPANZA_WHATSAPP_KEEP_AWAKE === "true";

let startupError = "";
if (requested) {
  if (!isAbsolute(authDir)) startupError = "Set TRIPANZA_WHATSAPP_AUTH_DIR to an absolute path.";
  else if (!persistentAuth && !ephemeralAuth) startupError = "Confirm persistent storage or explicitly allow ephemeral WhatsApp sessions.";
  else if (!apiKey || !webhookSecret) startupError = "Set TRIPANZA_WHATSAPP_API_KEY and WP_WEBHOOK_SECRET.";
  else {
    try { if (new URL(webhookUrl).protocol !== "https:") startupError = "WhatsApp CRM webhook must use HTTPS."; }
    catch { startupError = "Set a valid HTTPS WhatsApp CRM webhook URL."; }
  }
  if (startupError) console.error(`WhatsApp was not started: ${startupError}`);
  else if (!persistentAuth) console.warn("WhatsApp is using temporary storage. A Render restart, spin-down or deploy can require QR re-pairing.");
}

const app = next({ dev: process.env.NODE_ENV !== "production" });
await app.prepare();
const handle = app.getRequestHandler();
let runtime = null;
if (requested && !startupError) {
  try {
    const { createWhatsAppRuntime } = await import("./server/whatsapp/runtime.mjs");
    runtime = createWhatsAppRuntime({ authDir, webhookUrl, webhookSecret, nativeLinkCta: process.env.ENABLE_NATIVE_LINK_CTA === "true" });
    await runtime.start();
  } catch (error) {
    console.error("WhatsApp startup failed:", error);
    startupError = "WhatsApp could not start. Check the service logs.";
    runtime = null;
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && new URL(req.url || "/", "http://localhost").pathname === "/_tripanza_whatsapp_ping") {
      res.writeHead(204, { "Cache-Control": "no-store" });
      res.end();
      return;
    }
    if (await handleWhatsAppHttp(req, res, { runtime, apiKey, wordpressOrigin, enabled: !!runtime, startupError })) return;
    await handle(req, res);
  } catch (error) {
    console.error("Integrated server request failed:", error);
    if (!res.headersSent) res.writeHead(500, { "Cache-Control": "no-store" });
    res.end("Server error");
  }
});
const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => console.log(`Tripanza Next.js listening on ${port}${runtime ? " with WhatsApp enabled" : " (WhatsApp disabled)"}`));

let keepAwakeTimer = null;
if (runtime && !persistentAuth && ephemeralAuth && freeKeepAwake && process.env.RENDER_EXTERNAL_URL) {
  try {
    const url = new URL("/_tripanza_whatsapp_ping", process.env.RENDER_EXTERNAL_URL);
    if (url.protocol !== "https:") throw new Error("HTTPS is required");
    keepAwakeTimer = setInterval(() => {
      void fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) })
        .catch(error => console.warn("WhatsApp keep-awake request failed:", error.message));
    }, 10 * 60 * 1000);
    keepAwakeTimer.unref();
    console.log("WhatsApp Free-mode keep-awake request scheduled every 10 minutes.");
  } catch (error) { console.warn("WhatsApp keep-awake was not configured:", error.message); }
}

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  if (keepAwakeTimer) clearInterval(keepAwakeTimer);
  runtime?.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 15_000).unref();
});
