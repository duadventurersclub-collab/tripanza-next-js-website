import { createServer } from "node:http";
import { isAbsolute } from "node:path";
import next from "next";
import { handleWhatsAppHttp } from "./server/whatsapp/http.mjs";

const enabled = process.env.TRIPANZA_WHATSAPP_ENABLED === "true";
const authDir = process.env.TRIPANZA_WHATSAPP_AUTH_DIR || "";
const apiKey = process.env.TRIPANZA_WHATSAPP_API_KEY || "";
const webhookSecret = process.env.WP_WEBHOOK_SECRET || "";
const webhookUrl = process.env.TRIPANZA_WHATSAPP_CRM_WEBHOOK_URL || "https://tripanza.com/wp-json/whatsapp-ai/v1/server-reply/";
const wordpressOrigin = process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com";

if (enabled) {
  if (!isAbsolute(authDir) || process.env.TRIPANZA_WHATSAPP_PERSISTENT_STORAGE_CONFIRMED !== "yes") throw new Error("WhatsApp requires an absolute persistent auth directory and explicit storage confirmation.");
  if (!apiKey || !webhookSecret) throw new Error("WhatsApp API key and WordPress webhook secret must be configured.");
  if (new URL(webhookUrl).protocol !== "https:") throw new Error("WhatsApp CRM webhook must use HTTPS.");
}

const app = next({ dev: process.env.NODE_ENV !== "production" });
await app.prepare();
const handle = app.getRequestHandler();
let runtime = null;
if (enabled) {
  const { createWhatsAppRuntime } = await import("./server/whatsapp/runtime.mjs");
  runtime = createWhatsAppRuntime({ authDir, webhookUrl, webhookSecret, nativeLinkCta: process.env.ENABLE_NATIVE_LINK_CTA === "true" });
  await runtime.start();
}

const server = createServer(async (req, res) => {
  try {
    if (await handleWhatsAppHttp(req, res, { runtime, apiKey, wordpressOrigin, enabled })) return;
    await handle(req, res);
  } catch (error) {
    console.error("Integrated server request failed:", error);
    if (!res.headersSent) res.writeHead(500, { "Cache-Control": "no-store" });
    res.end("Server error");
  }
});
const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => console.log(`Tripanza Next.js listening on ${port}${enabled ? " with WhatsApp enabled" : " (WhatsApp disabled)"}`));

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  runtime?.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 15_000).unref();
});
