/** Compare a browser request with the public app origin behind reverse proxies. */
export function validRequestOrigin(request: Request) {
  const value = request.headers.get("origin");
  if (!value) return request.headers.get("sec-fetch-site") !== "cross-site";
  let origin: URL;
  try { origin = new URL(value); } catch { return false; }
  if (!["http:", "https:"].includes(origin.protocol)) return false;
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim();
  const proto = (request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "")).split(",")[0].trim();
  const candidates = [new URL(request.url).origin, process.env.NEXT_PUBLIC_SITE_URL, process.env.RENDER_EXTERNAL_URL];
  if (host && ["http", "https"].includes(proto)) candidates.push(`${proto}://${host}`);
  if (candidates.some(candidate => {
    try { return candidate && new URL(candidate).origin === origin.origin; } catch { return false; }
  })) return true;
  return request.headers.get("sec-fetch-site") === "same-origin";
}
