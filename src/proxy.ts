import { NextResponse, type NextRequest } from "next/server";
import { readLiveSiteSettings, liveSettingsUrl, LIVE_SETTINGS_HEADERS } from "@/lib/site-settings";
import { getTourPageControls } from "@/lib/tour-page-controls";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tripanza-render-settings");
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  if (path.startsWith("/home-cache/")) {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    return NextResponse.redirect(target);
  }
  // The uncached renderer is only an internal rewrite target, never another URL
  // for indexing or sharing the same tour.
  if (path.startsWith("/tour-live/")) {
    const target = request.nextUrl.clone();
    target.pathname = path.replace(/^\/tour-live\//, "/tours/");
    return NextResponse.redirect(target);
  }
  // Always preserve admin recovery, auth, existing booking/payment support,
  // legal notices and contact access. No role or bypass cookie is trusted.
  if (/^\/(?:admin|api|login|logout|account|dashboard|my-bookings|wallet|checkout|payment|booking-status|contact|tnc|privacy-policy|cookies-policy|cancellation-policy|disclaimer)(?:\/|$)/.test(path)) return next();
  // Never read a browser-supplied snapshot when deciding maintenance access.
  const tourPage = /^\/tours\/[a-zA-Z0-9-]+\/?$/.test(path);
  const homePage = path === "/";
  const settings = await (tourPage || homePage ? getTourPageControls() : readLiveSiteSettings());
  // Dynamic pages reuse the enforcement snapshot. The public root layout and
  // cached tour renderer deliberately avoid request headers to preserve ISR.
  requestHeaders.set("x-tripanza-render-settings", Buffer.from(JSON.stringify(settings)).toString("base64url"));
  const render = () => {
    if (homePage && settings.public_cache_enabled && settings.tour_cache_seconds > 0 && settings.site_cache_seconds > 0) {
      const target = request.nextUrl.clone();
      target.pathname = "/home-cache/home";
      return NextResponse.rewrite(target, { request: { headers: requestHeaders } });
    }
    if (tourPage && (!settings.public_cache_enabled || settings.tour_cache_seconds === 0)) {
      const target = request.nextUrl.clone();
      target.pathname = path.replace(/^\/tours\//, "/tour-live/");
      return NextResponse.rewrite(target, { request: { headers: requestHeaders } });
    }
    return next();
  };
  if (!settings.maintenance_enabled) return render();
  const token = request.cookies.get("tripanza_session")?.value;
  if (token) {
    try {
      const allowed = await fetch(liveSettingsUrl("admin/settings"), { cache: "no-store", headers: { ...LIVE_SETTINGS_HEADERS, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
      if (allowed.ok) return render();
    } catch { /* Cannot grant an unverified administrator bypass. */ }
  }
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Back shortly | Tripanza</title><meta name="robots" content="noindex"><style>body{margin:0;background:#f7f9ff;color:#171923;font:16px system-ui;display:grid;min-height:100vh;place-items:center}main{max-width:560px;padding:32px}small,a{color:#3157d5}h1{font-size:48px;letter-spacing:-2px}p{line-height:1.7}nav{display:flex;gap:24px;flex-wrap:wrap}</style></head><body><main><small>TRIPANZA</small><h1>Back shortly.</h1><p>${escapeHtml(settings.maintenance_message)}</p><p>Your existing trips and bookings are safe.</p><nav><a href="/account">My account</a><a href="/contact">Contact us</a><a href="/login">Sign in</a></nav></main></body></html>`, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Retry-After": "300" } });
}

export const config = { matcher: ["/((?!_next|favicon.ico|robots.txt|sitemap.xml|fonts/|images/).*)"] };
