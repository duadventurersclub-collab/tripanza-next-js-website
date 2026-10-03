import { createHmac } from "node:crypto";

export async function reportOperationalError(code: "server_error" | "upstream_error" | "payment_error", area: "tours" | "booking" | "payment" | "host" | "settings" | "chat" | "site") {
  const secret = process.env.TRIPANZA_MONITORING_SECRET || "";
  if (secret.length < 32) return;
  const body = JSON.stringify({ code, area });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const origin = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");
  try {
    await fetch(`${origin}/wp-json/tripanza-headless/v1/monitoring/event`, { method: "POST", cache: "no-store", body, signal: AbortSignal.timeout(2000), headers: { "Content-Type": "application/json", "X-Tripanza-Timestamp": timestamp, "X-Tripanza-Signature": createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex") } });
  } catch { /* Monitoring must never break checkout or recurse on failures. */ }
}
