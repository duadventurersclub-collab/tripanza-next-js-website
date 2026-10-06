import https from "node:https";
import dns from "node:dns/promises";
import net from "node:net";
import { config } from "../config.js";

export function publicUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Enter a public HTTPS URL");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443"
    || url.hostname === "localhost" || /\.(?:local|localhost|internal)$/.test(url.hostname)) throw new Error("Enter a public HTTPS URL");
  if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && !publicAddress(url.hostname.replace(/^\[|\]$/g, ""))) throw new Error("Private network URLs are unavailable");
  return url.href;
}
export function publicAddress(address: string): boolean {
  const value = address.toLowerCase();
  if (net.isIP(value) === 4) {
    const [a, b] = value.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254
      || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0)
      || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19));
  }
  // Permit global-unicast IPv6 only; excludes loopback, mapped IPv4, ULA,
  // link-local and transition addresses that could reach a private network.
  return net.isIP(value) === 6 && /^[23][0-9a-f]{3}:/.test(value)
    && !/^(?:2001:(?:0:|db8:)|2002:)/.test(value);
}
export interface TransportOptions { method?: string; body?: string; headers?: Record<string, string>; maxBytes?: number }
export interface TransportResult { status: number; body: Buffer; mime: string }
let mock: ((url: string, options: TransportOptions) => Promise<TransportResult>) | null = null;
export function setAutomationTestTransport(value: typeof mock) {
  if (config.nodeEnv !== "test") throw new Error("Test transport unavailable");
  mock = value;
}
export async function publicRequest(value: string, options: TransportOptions = {}): Promise<TransportResult> {
  const url = publicUrl(value);
  if (mock) return mock(url, options);
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: options.method || "GET", headers: options.headers,
      lookup: ((hostname: string, opts: any, callback: any) => {
        dns.lookup(hostname, { all: true, verbatim: true }).then(addresses => {
          if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new Error("Private network addresses are unavailable");
          if (opts.all) callback(null, addresses); else callback(null, addresses[0].address, addresses[0].family);
        }).catch(error => callback(error));
      }) as any,
    }, response => {
      const limit = options.maxBytes ?? 65536;
      if (Number(response.headers["content-length"] || 0) > limit) { response.destroy(); reject(new Error("Response exceeds size limit")); return; }
      let size = 0; const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) { response.destroy(new Error("Response exceeds size limit")); return; }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ status: response.statusCode || 0, body: Buffer.concat(chunks), mime: String(response.headers["content-type"] || "").split(";")[0] }));
    });
    request.setTimeout(12000, () => request.destroy(new Error("Network timeout")));
    const deadline = setTimeout(() => request.destroy(new Error("Network deadline exceeded")), 12000);
    deadline.unref(); request.on("close", () => clearTimeout(deadline));
    request.on("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}
