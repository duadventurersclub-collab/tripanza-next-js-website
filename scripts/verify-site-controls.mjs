// Run after npm run build. Uses mock WP, real Next.js, and optional browser/PHP
// syntax tooling from the same temporary directory as verify-host-studio.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import vm from "node:vm";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(import.meta.url);
const ts = require("typescript");
const moduleRoot = process.argv.find(arg => arg.startsWith("--modules="))?.slice(10) || path.join(os.tmpdir(), "tripanza-studio-validation", "node_modules");
const optional = createRequire(path.join(moduleRoot, "fixture.cjs"));
const parser = optional("php-parser");
const { chromium } = optional("@playwright/test");
const source = file => fs.readFileSync(path.join(root, file), "utf8");
const plugin = source("wordpress/tripanza-site-controls/tripanza-site-controls.php");
new parser.Engine({ parser: { version: "7.4", suppressErrors: false } }).parseCode(plugin);
assert.ok(!plugin.includes("wp_cache_flush("));
assert.ok(!plugin.includes("w3tc_flush_all("));
assert.ok(!plugin.includes("wp_delete_post("));
assert.ok(plugin.includes("current_user_can('manage_options')"));
assert.ok(plugin.includes("check_admin_referer('tripanza_site_controls')"));
assert.ok(plugin.includes("'gate_rest'), 1000, 3"));
assert.ok(plugin.includes("'gate_pages'), -200"));

function load(file, overrides = {}, globals = {}) {
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, require: name => overrides[name] || require(name), process, URL, Response, AbortSignal, Date, ...globals };
  vm.runInNewContext(output, context, { filename: file });
  return context.exports;
}
const types = load("src/lib/site-settings-types.ts");
let settings = { ...types.DEFAULT_SETTINGS, host_enabled: true, revision: "fixture", cache_revision: "fixture" };
const liveRequests = [];
const helpers = load("src/lib/site-settings.ts", { react: { cache: fn => fn }, "./site-settings-types": types }, { fetch: async (url, options) => {
  liveRequests.push({ url, options });
  return Response.json(settings);
} });
let options = await helpers.publicCacheOptions("tour");
assert.equal(options.next.revalidate, 300);
assert.ok(options.next.tags.includes("tours"));
assert.equal(options.headers["X-Tripanza-Cache-Revision"], "fixture");
settings.public_cache_enabled = false;
assert.equal((await helpers.publicCacheOptions("tour")).cache, "no-store");
assert.equal(new Set(liveRequests.map(request => new URL(request.url).searchParams.get("_tripanza_live"))).size, liveRequests.length);
for (const request of liveRequests) {
  assert.ok(new URL(request.url).searchParams.get("_tripanza_live"));
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.headers["Cache-Control"], "no-cache, no-store");
}
settings.public_cache_enabled = true; settings.tour_cache_seconds = 0;
assert.equal((await helpers.publicCacheOptions("tour")).cache, "no-store");
const offline = load("src/lib/site-settings.ts", { react: { cache: fn => fn }, "./site-settings-types": types }, { fetch: async () => { throw new Error("offline"); } });
assert.equal((await offline.getSiteSettings()).host_enabled, false);

const storage = new Map();
const browserCache = load("src/lib/browser-account-cache.ts", {}, { window: { sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } } });
browserCache.writeAccountCache({ authenticated: true, id: 1 }, settings);
assert.equal(browserCache.readAccountCache(settings).id, 1);
assert.equal(browserCache.readAccountCache({ ...settings, cache_revision: "new" }), null);
browserCache.writeAccountCache({ authenticated: true }, { ...settings, browser_cache_seconds: 0 });
assert.equal(storage.size, 0);
const paths = load("src/lib/host-paths.ts");
for (const route of ["/host", "/host/register", "/host/test/reels", "/host-dashboard", "/poster-download", "/add-your-own-trip", "/crm"]) assert.ok(paths.isHostPath(route));
for (const route of ["/admin/settings", "/dashboard", "/tours/host-trip"]) assert.ok(!paths.isHostPath(route));
let bookingCalls = 0;
const wp = load("src/lib/wp.ts", { "./st-tours": {}, "./site-settings": { getSiteSettings: async () => settings } }, { fetch: async () => Response.json([{ id: ++bookingCalls }]) });
await wp.getUserBookings("session-one"); await wp.getUserBookings("session-one");
assert.equal(bookingCalls, 1);
await wp.getUserBookings("session-two"); assert.equal(bookingCalls, 2, "Bookings must remain isolated per session");
settings.cache_revision = "booking-purge";
await wp.getUserBookings("session-one"); assert.equal(bookingCalls, 3);
settings.booking_cache_seconds = 0;
await wp.getUserBookings("session-one"); await wp.getUserBookings("session-one"); assert.equal(bookingCalls, 5);
console.log("PASS: PHP 7.4 syntax, fail-closed flags, configurable cache options, group tags, browser revision/disable, server booking isolation/purge/disable checks");

settings = { ...types.DEFAULT_SETTINGS, host_enabled: true, revision: "fixture", cache_revision: "fixture" };
let saves = 0, purges = 0, hostRequests = 0;
const staleSettings = { ...settings };
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://mock");
  const relative = url.pathname.replace("/wp-json/tripanza-headless/v1/", "");
  const auth = req.headers.authorization?.replace("Bearer ", "");
  const send = (data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
  // Simulate yesterday's CDN bug: fixed GET URLs keep serving Host enabled.
  if (relative === "settings/public") return send(url.searchParams.has("_tripanza_live") ? settings : staleSettings);
  if (relative === "tours/fixture-tour") return send({
    id: 42, slug: "fixture-tour", title: "Fixture mountain escape", excerpt: "A test trip.",
    currency: "INR", price: "10000", featured_image: null,
    details: { origin: "Delhi", duration: { days: "3", nights: "2" },
      pricing: { quad: { amount: 10000, display: "₹10,000" } },
      itinerary: [{ day: 1, title: "Arrival", description: "Meet the crew." }] },
  });
  if (relative.startsWith("admin/")) {
    if (!auth) return send({ message: "Please sign in." }, 401);
    if (auth !== "fixture-admin") return send({ message: "Administrator access required." }, 403);
    const adminPayload = () => ({ settings, capabilities: { pdf: false, page_cache: false } });
    if (req.method === "GET") return send(url.searchParams.has("_tripanza_live") ? adminPayload() : { ...adminPayload(), settings: staleSettings });
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    if (relative === "admin/settings") {
      if (body.revision !== settings.revision) return send({ message: "Settings changed in another window. Reload before saving." }, 409);
      settings = { ...body, revision: `save-${++saves}`, cache_revision: `save-${saves}`, updated_at: new Date().toISOString(), updated_by: "Fixture Admin" };
      return send(adminPayload());
    }
    purges++;
    if (["all", "bookings", "browser"].includes(body.scope)) settings = { ...settings, revision: `purge-${purges}`, cache_revision: `purge-${purges}` };
    return send({ ok: true, scope: body.scope });
  }
  if (relative.startsWith("host")) {
    hostRequests++;
    if (!settings.host_enabled) return send({ message: "Host disabled" }, 503);
    if (relative === "host") return send({ trips: [], hosts: [], leaderboard: [] });
    return send({ id: 1, name: "Fixture Host", slug: "fixture-host", logo: "", tagline: "", bio: "", cover: "", instagram: "", rating: 0, verified: false, trip_count: 0, theme: "default", font: "inter", palette: {}, trips: [] });
  }
  if (relative === "account") return send({ id: 1, name: "Fixture Admin", email: "admin@example.test", roles: auth === "fixture-admin" ? ["administrator"] : ["subscriber"], avatar: "", wallet: { balance: 0, source_balances: { cashback: 0, commission: 0, general: 0 }, transactions: [], stats: { earned: 0, used: 0, movements: 0 } }, bookings: [], profile: { id: 1, display_name: "Fixture Admin", email: "admin@example.test", first_name: "Fixture", last_name: "Admin" } });
  if (relative === "me") return send({ id: 1, display_name: "Fixture Admin", email: "admin@example.test" });
  if (relative === "my-bookings") return send([]);
  return send({ message: "Fixture route not found" }, 404);
});
await new Promise(resolve => mock.listen(0, "127.0.0.1", resolve));
const appPort = Number(process.env.STUDIO_TEST_PORT || 3038);
const origin = `http://127.0.0.1:${appPort}`;
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(appPort)], { cwd: root, env: { ...process.env, WORDPRESS_URL: `http://127.0.0.1:${mock.address().port}`, NEXT_PUBLIC_SITE_URL: origin }, stdio: ["ignore", "pipe", "pipe"] });
let logs = ""; app.stdout.on("data", text => { logs += text; }); app.stderr.on("data", text => { logs += text; });
let browser;
try {
  for (let retry = 0; retry < 80; retry++) {
    try { if ((await fetch(`${origin}/api/settings/public`)).ok) break; } catch { /* Starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
    if (retry === 79) throw new Error(`Next.js did not start: ${logs}`);
  }
  const headers = { Cookie: "tripanza_session=fixture-admin", Origin: origin, "Content-Type": "application/json" };
  for (const hostEnabled of [true, false]) {
    settings.host_enabled = hostEnabled;
    const response = await fetch(`${origin}/tours/fixture-tour`);
    assert.equal(response.status, 200, `Tour details must render with Host ${hostEnabled ? "on" : "off"}`);
    const html = await response.text();
    assert.ok(html.includes("Fixture mountain escape"));
    assert.ok(html.includes("Meet the crew."));
    assert.ok(!html.includes("Internal Server Error"));
  }
  const missingTour = await fetch(`${origin}/tours/fixture-missing`);
  // Next's loading boundary can stream HTTP 200 before notFound() resolves.
  assert.ok([200, 404].includes(missingTour.status));
  const missingHtml = await missingTour.text();
  assert.ok(missingHtml.includes("This page could not be found"));
  assert.ok(missingHtml.includes('name="robots" content="noindex"'));
  settings.host_enabled = true;
  assert.ok(!logs.includes("Page changed from static to dynamic"));
  console.log("PASS: production tour details load with Host on/off; missing tours render not-found/noindex, not static-to-dynamic 500");
  assert.equal((await fetch(`${origin}/api/admin/settings`)).status, 401);
  assert.equal((await fetch(`${origin}/api/admin/settings`, { headers: { Cookie: "tripanza_session=fixture-user" } })).status, 403);
  const denied = await fetch(`${origin}/api/admin/settings`, { method: "POST", headers: { ...headers, Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" }, body: JSON.stringify(settings) });
  assert.equal(denied.status, 403); assert.equal(saves, 0);
  const deniedPurge = await fetch(`${origin}/api/admin/cache`, { method: "POST", headers: { ...headers, Cookie: "tripanza_session=fixture-user" }, body: JSON.stringify({ scope: "all" }) });
  assert.equal(deniedPurge.status, 403); assert.equal(purges, 0);
  assert.equal((await fetch(`${origin}/api/admin/cache`, { method: "POST", headers, body: JSON.stringify({ scope: "unknown" }) })).status, 400);
  console.log("PASS: anonymous/non-admin access denied; cross-origin writes denied; invalid purge scopes rejected");
  browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  await context.addCookies([{ name: "tripanza_session", value: "fixture-admin", url: origin }]);
  const page = await context.newPage();
  const errors = []; page.on("pageerror", error => errors.push(`${page.url()}: ${error.message}`));
  await page.goto(`${origin}/tours/fixture-tour`);
  await page.getByRole("heading", { name: "Fixture mountain escape", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Fixture mountain escape", exact: true }).waitFor();
  await page.goto(`${origin}/admin/settings`);
  await page.getByRole("heading", { name: /Your site/ }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Save settings" }).isDisabled(), true);
  const hostTab = await context.newPage(); await hostTab.goto(`${origin}/host`);
  const menuTab = await context.newPage();
  await menuTab.goto(`${origin}/tours`);
  await menuTab.getByRole("button", { name: "Me", exact: true }).click();
  await menuTab.locator('.tp-profile-menu a[href="/host"]').waitFor({ state: "visible" });
  const toggle = page.locator(".as-host input[type=checkbox]");
  await page.locator(".as-host .as-toggle>span").click();
  assert.equal(await toggle.isChecked(), false);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByRole("status").filter({ hasText: "Settings saved" }).waitFor();
  assert.equal(settings.host_enabled, false);
  await page.reload();
  await page.getByRole("heading", { name: /Your site/ }).waitFor();
  assert.equal(await toggle.isChecked(), false, "Saved Host disable must survive reload despite stale upstream GETs");
  await menuTab.evaluate(() => window.dispatchEvent(new Event("focus")));
  await menuTab.locator('.tp-profile-menu a[href="/host"]').waitFor({ state: "detached" });
  await menuTab.reload();
  assert.equal(await menuTab.locator('a[href="/host"]').count(), 0, "Disabled Become Host must not be in server-rendered menu");
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`${origin}/tours`);
  await guest.getByRole("button", { name: "Me", exact: true }).click();
  assert.equal(await guest.locator('.tp-profile-menu a[href="/host"]').count(), 0, "Guest menu must also hide Become Host");
  for (const route of ["/host", "/host?register=1", "/host/register"]) {
    await guest.goto(origin + route);
    await guest.waitForURL(`${origin}/tours`);
    assert.equal(await guest.locator('.th-register-modal, .th-final').count(), 0, "Disabled onboarding page must not render");
  }
  const previousHosts = hostRequests;
  for (const endpoint of ["/api/host/me", "/api/host/registration", "/api/host/studio/tools"]) {
    const response = await fetch(origin + endpoint, { method: endpoint.endsWith("me") ? "GET" : "POST", headers, body: endpoint.endsWith("me") ? undefined : "{}" });
    assert.equal(response.status, 503, endpoint);
  }
  assert.equal(hostRequests, previousHosts, "Disabled Next.js endpoints must not forward Host requests");
  await hostTab.evaluate(() => window.dispatchEvent(new Event("focus")));
  await hostTab.waitForURL(`${origin}/tours`);
  for (const route of ["/host-dashboard", "/poster-download", "/add-your-own-trip", "/host/example/reels", "/crm"]) {
    const html = await (await fetch(origin + route, { headers })).text();
    assert.ok(html.includes("Hosting is currently unavailable."), route);
  }
  await page.locator(".as-host .as-toggle>span").click();
  assert.equal(await toggle.isChecked(), true);
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByRole("status").filter({ hasText: "Settings saved" }).waitFor();
  assert.equal(settings.host_enabled, true);
  await menuTab.evaluate(() => window.dispatchEvent(new Event("focus")));
  await menuTab.getByRole("button", { name: "Me", exact: true }).click();
  await menuTab.locator('.tp-profile-menu a[href="/host"]').waitFor({ state: "visible" });
  await guest.goto(`${origin}/host/register`);
  await guest.waitForURL(`${origin}/host?register=1`);
  // Guests see the Host landing again; registration still requires sign-in.
  await guest.getByRole("button", { name: /^Become a host/ }).first().waitFor();
  await guest.getByRole("button", { name: /^Become a host/ }).first().click();
  await guest.waitForURL(`${origin}/login?next=%2Fhost%3Fregister%3D1`);
  await guestContext.close();
  const beforePurge = settings.cache_revision;
  page.once("dialog", dialog => dialog.accept());
  await page.locator(".as-purges>div").first().getByRole("button").click();
  await page.getByRole("status").filter({ hasText: "Cache refresh requested" }).waitFor();
  assert.notEqual(settings.cache_revision, beforePurge);
  assert.equal(await page.getByRole("button", { name: "Clear all generated PDF caches" }).isDisabled(), true);
  const artifact = path.join(os.tmpdir(), "tripanza-admin-settings-desktop.png");
  await page.screenshot({ path: artifact, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(os.tmpdir(), "tripanza-admin-settings-mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
  console.log(`PASS: AJAX settings save/reload through stale CDN simulation, guest/signed-in Become Host menu hiding, entry-page redirects, open-tab blocking, re-enable, cache refresh, unsupported module controls, mobile layout. Screenshot: ${artifact}`);
} finally {
  await browser?.close(); app.kill(); await new Promise(resolve => mock.close(resolve));
}
