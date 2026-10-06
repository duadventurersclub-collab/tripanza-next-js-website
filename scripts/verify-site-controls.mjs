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
import { adminDashboardFixture } from "./admin-dashboard-fixture.mjs";

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
assert.ok(plugin.includes("'controls_version' => self::VERSION"));
assert.ok(plugin.includes("unset($settings['updated_by'], $settings['alert_email'], $settings['error_alerts_enabled'])"));
assert.ok(plugin.includes("hash_equals(hash_hmac('sha256'"));
assert.ok(plugin.includes("array('from' => $before[$key], 'to' => $settings[$key])"));

function load(file, overrides = {}, globals = {}) {
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, require: name => overrides[name] || require(name), process, URL, Response, AbortSignal, Date, Buffer, ...globals };
  vm.runInNewContext(output, context, { filename: file });
  return context.exports;
}
const types = load("src/lib/site-settings-types.ts");
let monitorRequest;
const monitor = load("src/lib/error-monitoring.ts", {}, { process: { env: { WORDPRESS_URL: "https://fixture.test", TRIPANZA_MONITORING_SECRET: "fixture-monitoring-secret-at-least-32-characters" } }, fetch: async (url, init) => { monitorRequest = { url, init }; return Response.json({ ok: true }); } });
await monitor.reportOperationalError("server_error", "booking");
assert.deepEqual(JSON.parse(monitorRequest.init.body), { code: "server_error", area: "booking" });
assert.equal(monitorRequest.init.headers["X-Tripanza-Signature"], require("node:crypto").createHmac("sha256", "fixture-monitoring-secret-at-least-32-characters").update(`${monitorRequest.init.headers["X-Tripanza-Timestamp"]}.${monitorRequest.init.body}`).digest("hex"));
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
const snapshotHelpers = load("src/lib/site-settings.ts", { react: { cache: fn => fn }, "./site-settings-types": types, "next/headers": { headers: async () => new Headers({ "x-tripanza-render-settings": Buffer.from(JSON.stringify(settings)).toString("base64url") }) } }, { fetch: async () => { throw new Error("Snapshot should avoid another upstream fetch"); } });
assert.equal((await snapshotHelpers.getSiteSettings()).revision, settings.revision);

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
const audit = [];
const staleSettings = { ...settings };
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://mock");
  const relative = url.pathname.replace("/wp-json/tripanza-headless/v1/", "");
  const auth = req.headers.authorization?.replace("Bearer ", "");
  const send = (data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
  // Simulate yesterday's CDN bug: fixed GET URLs keep serving Host enabled.
  if (relative === "settings/public") {
    const publicSettings = { ...(url.searchParams.has("_tripanza_live") ? settings : staleSettings) };
    delete publicSettings.alert_email; delete publicSettings.error_alerts_enabled;
    return send(publicSettings);
  }
  if (relative === "tours/fixture-tour") return send({
    id: 42, slug: "fixture-tour", title: "Fixture mountain escape", excerpt: "A test trip.",
    currency: "INR", price: "10000", featured_image: null,
    details: { origin: "Delhi", duration: { days: "3", nights: "2" },
      pricing: { quad: { amount: 10000, display: "₹10,000" } },
      itinerary: [{ day: 1, title: "Arrival", description: "Meet the crew." }] },
  });
  if (relative === "site") return send({ name: "Tripanza", description: "Fixture site", url: "http://fixture", admin_url: "", site_language: "en-IN", timezone: "Asia/Kolkata" });
  if (relative === "tours") return send({ admin_only: true, items: [{ id: 42, slug: "fixture-tour", title: "Fixture mountain escape", currency: "INR", price: "10000", details: { origin: "Delhi", duration: { days: "3", nights: "2" }, pricing: { quad: { amount: 10000, display: "₹10,000" } } } }] });
  if (relative === "tours/fixture-missing") return send({ code: "tripanza_tour_not_found", message: "Tour not found." }, 404);
  if (relative.startsWith("admin/")) {
    if (!auth) return send({ message: "Please sign in." }, 401);
    if (auth !== "fixture-admin") return send({ message: "Administrator access required." }, 403);
    if (relative === "admin/identity") return send({ id: 1, name: "Fixture Admin", api_version: "2.0.0" });
    const access = { "admin/workspace": "admin_dashboard_enabled", "admin/bookings": "admin_booking_history_enabled", "admin/bookings/create": "admin_booking_create_enabled" };
    const accessFlag = access[relative] || (/^admin\/bookings\/[1-9][0-9]*\/editor$/.test(relative) ? "admin_booking_editor_enabled" : "");
    if (accessFlag && !settings[accessFlag]) return send({ message: "This admin page is disabled in Site Settings." }, 503);
    if (relative === "admin/workspace") return send(adminDashboardFixture());
    const adminPayload = () => ({ settings, controls_version: "1.3.0", capabilities: { pdf: false, page_cache: false } });
    if (relative === "admin/operations") return send({ checked_at: new Date().toISOString(), health: { wordpress_version: "6.8", php_version: "8.3", database: true, monitoring_configured: false, plugins: [{ name: "Tripanza Site Controls", version: "1.3.0", active: true }] }, audit: [...audit].reverse(), errors: [] });
    if (req.method === "GET") return send(url.searchParams.has("_tripanza_live") ? adminPayload() : { ...adminPayload(), settings: staleSettings });
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    if (relative === "admin/settings") {
      if (body.revision !== settings.revision) return send({ message: "Settings changed in another window. Reload before saving." }, 409);
      const changes = Object.fromEntries(Object.keys(body).filter(key => !["revision", "cache_revision", "updated_at", "updated_by"].includes(key) && body[key] !== settings[key]).map(key => [key, { from: settings[key], to: body[key] }]));
      settings = { ...body, revision: `save-${++saves}`, cache_revision: `save-${saves}`, updated_at: new Date().toISOString(), updated_by: "Fixture Admin" };
      audit.push({ action: "settings_saved", user_id: 1, actor: "Fixture Admin", at: settings.updated_at, changes });
      return send(adminPayload());
    }
    purges++;
    audit.push({ action: `purge_${body.scope}`, user_id: 1, actor: "Fixture Admin", at: new Date().toISOString(), changes: {} });
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
  for (const session of [null, "fixture-user", "fixture-invalid"]) {
    const visitorContext = await browser.newContext();
    try {
      if (session) await visitorContext.addCookies([{ name: "tripanza_session", value: session, url: origin }]);
      const visitor = await visitorContext.newPage();
      for (const route of ["/admin/settings", "/admin"]) {
        await visitor.goto(origin + route);
        await visitor.waitForURL(`${origin}/`);
        assert.equal(await visitor.locator(".admin-settings").count(), 0, `Unauthorized ${session || "guest"} must not see settings`);
      }
      await visitor.reload();
      assert.equal(new URL(visitor.url()).pathname, "/");
    } finally { await visitorContext.close(); }
  }
  console.log("PASS: guests, non-admins and invalid sessions visiting admin/settings or admin redirect home; APIs still deny unauthorized access");
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  await context.addCookies([{ name: "tripanza_session", value: "fixture-admin", url: origin }]);
  const page = await context.newPage();
  const errors = []; page.on("pageerror", error => errors.push(`${page.url()}: ${error.message}`));
  assert.equal((await fetch(`${origin}/api/admin/dashboard`)).status, 401);
  assert.equal((await fetch(`${origin}/api/admin/dashboard`, { headers: { Cookie: "tripanza_session=fixture-user" } })).status, 403);
  const deniedDashboard = await fetch(`${origin}/api/admin/dashboard`, { method: "POST", headers: { Cookie: "tripanza_session=fixture-admin", Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle_todo" }) });
  assert.equal(deniedDashboard.status, 403);
  await page.goto(`${origin}/admin`);
  await page.getByRole("heading", { name: "Welcome to Tripanza Dashboard" }).waitFor();
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(await page.locator(".tp-bottom-menu").count(), 0);
  await page.getByRole("button", { name: "Open admin menu" }).click();
  await page.getByRole("link", { name: "Site Settings", exact: true }).click();
  await page.waitForURL(`${origin}/admin/settings`);
  await page.getByRole("button", { name: "Open admin menu" }).click();
  await page.locator("#adminMenu.is-active").waitFor();
  assert.equal(await page.locator('.tp-admin-menu-user__meta strong').innerText(), "Fixture Admin");
  assert.equal(await page.getByRole("link", { name: "Site Settings", exact: true }).getAttribute("aria-current"), "page");
  await page.keyboard.press("Escape");
  console.log("PASS: native Next.js admin dashboard (no iframe), settings navigation, original drawer, guest/non-admin rejection and cross-origin write denial");
  await page.goto(`${origin}/tours/fixture-tour`);
  await page.getByRole("heading", { name: "Fixture mountain escape", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Fixture mountain escape", exact: true }).waitFor();
  await page.goto(`${origin}/admin/settings`);
  await page.getByRole("heading", { name: /Your site/ }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Save settings" }).isDisabled(), true);
  const openAdminTab = await context.newPage();
  await openAdminTab.goto(`${origin}/admin`);
  await openAdminTab.getByRole("heading", { name: "Welcome to Tripanza Dashboard" }).waitFor();
  for (const label of ["Admin dashboard", "Booking history", "Create bookings", "Booking editor"]) {
    const toggle = page.getByLabel(label, { exact: true });
    await toggle.locator("..").locator("span").click();
    assert.equal(await toggle.isChecked(), false);
  }
  await page.getByRole("button", { name: "Save page access" }).click();
  await page.getByRole("status").filter({ hasText: "Settings saved" }).waitFor();
  await openAdminTab.evaluate(() => window.dispatchEvent(new Event("focus")));
  await openAdminTab.waitForURL(`${origin}/admin/settings`);
  await openAdminTab.close();
  const disabledPage = await context.newPage();
  for (const route of ["/admin", "/admin/bookings", "/admin/bookings/create", "/admin/bookings/42/edit"]) {
    await disabledPage.goto(origin + route);
    await disabledPage.waitForURL(`${origin}/admin/settings`);
  }
  await disabledPage.close();
  for (const endpoint of ["/api/admin/dashboard", "/api/admin/bookings", "/api/admin/bookings/create", "/api/admin/bookings/42/editor"]) {
    assert.equal((await fetch(origin + endpoint, { headers })).status, 503, endpoint);
  }
  assert.equal((await fetch(`${origin}/api/admin/settings`, { headers })).status, 200, "Admin settings must remain available");
  await page.reload();
  for (const label of ["Admin dashboard", "Booking history", "Create bookings", "Booking editor"]) {
    const toggle = page.getByLabel(label, { exact: true });
    await toggle.locator("..").locator("span").click();
    assert.equal(await toggle.isChecked(), true);
  }
  await page.getByRole("button", { name: "Save page access" }).click();
  await page.getByRole("status").filter({ hasText: "Settings saved" }).waitFor();
  console.log("PASS: all native admin pages can be disabled and restored; their APIs are gated while settings remain accessible");
  const hostTab = await context.newPage(); await hostTab.goto(`${origin}/host`);
  const menuTab = await context.newPage();
  await menuTab.goto(`${origin}/tours`);
  await menuTab.getByRole("button", { name: "Me", exact: true }).click();
  await menuTab.locator('.tp-profile-menu a[href="/host"]').waitFor({ state: "visible" });
  const toggle = page.locator(".as-card.as-host > .as-toggle > input[type=checkbox]").first();
  await page.locator(".as-card.as-host > .as-toggle > span").first().click();
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
  await page.getByRole("heading", { name: "Know what is running." }).waitFor();
  await page.getByText("Setup required: private secret on both servers", { exact: true }).waitFor();
  assert.equal((await fetch(`${origin}/api/admin/operations`)).status, 401);
  assert.equal((await fetch(`${origin}/api/admin/operations`, { headers: { Cookie: "tripanza_session=fixture-user" } })).status, 403);
  const operations = await (await fetch(`${origin}/api/admin/operations`, { headers })).json();
  assert.ok(operations.health.database); assert.equal(operations.diagnostics.stale_settings, true);
  assert.equal(operations.diagnostics.public_revision, settings.revision);
  assert.ok(operations.audit.some(event => event.changes.host_enabled?.to === false));
  console.log("PASS: private health/activity endpoints, old/new change history, unique live vs stale CDN revision diagnostics");

  const savedBaseline = { ...settings };
  const saveSettings = async changes => {
    const response = await fetch(`${origin}/api/admin/settings`, { method: "POST", headers, body: JSON.stringify({ ...settings, ...changes, revision: settings.revision }) });
    assert.equal(response.status, 200); return response.json();
  };
  await saveSettings({ ai_chat_enabled: false, reels_enabled: false, pdf_downloads_enabled: false, new_bookings_enabled: false, announcement_enabled: true, announcement_text: "Fixture launch announcement", announcement_link: "/tours", contact_email: "help@example.test", contact_phone: "+919876543210", whatsapp_number: "919876543210", instagram_url: "https://instagram.com/fixture", alert_email: "private-alert@example.test" });
  await page.reload();
  await page.getByLabel("AI trip assistant", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("AI trip assistant", { exact: true }).isChecked(), false);
  assert.equal(await page.getByRole("link", { name: /Fixture launch announcement/ }).count(), 0, "Public announcements must not change the original admin layout");
  const publicConfig = await (await fetch(`${origin}/api/settings/public`)).json();
  assert.ok(!publicConfig.alert_email, "Alert email must remain private");
  await page.goto(`${origin}/contact`);
  await page.getByRole("link", { name: /Fixture launch announcement/ }).waitFor();
  await page.getByRole("link", { name: /Email us help@example.test/ }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Chat on WhatsApp →", exact: true }).getAttribute("href"), "https://wa.me/919876543210");
  await page.goto(`${origin}/tours/fixture-tour`);
  assert.equal(await page.locator(".tp-tour-help-pill, .tp-mobile-booking-bar, #booking-request").count(), 0);
  assert.ok(await page.getByRole("button", { name: "Downloads paused" }).isDisabled());
  await page.goto(`${origin}/trips`); await page.waitForURL(`${origin}/tours`);
  for (const [endpoint, body] of [["/api/checkout", {}], ["/api/cart", {}], ["/api/itinerary-lead", {}], ["/api/tour-chat", { action: "ask" }], ["/api/host/reels", {}]]) {
    const response = await fetch(origin + endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    assert.equal(response.status, 503, `${endpoint} disabled before forwarding`);
  }
  console.log("PASS: feature switches survive reload; content/support links wired; disabled APIs reject direct requests; AI, booking and PDF controls reflect saved settings");

  await saveSettings({ ...savedBaseline, maintenance_enabled: true, maintenance_message: "Fixture scheduled maintenance <script>alert(1)</script>" });
  const maintenance = await fetch(`${origin}/tours`, { headers: { "X-Tripanza-Render-Settings": Buffer.from(JSON.stringify({ maintenance_enabled: false })).toString("base64url") } });
  assert.equal(maintenance.status, 503); assert.equal(maintenance.headers.get("retry-after"), "300");
  const maintenanceHtml = await maintenance.text(); assert.ok(maintenanceHtml.includes("&lt;script&gt;")); assert.ok(!maintenanceHtml.includes("<script>"));
  assert.equal((await fetch(`${origin}/tours`, { headers })).status, 200, "Verified admin bypass");
  assert.equal((await fetch(`${origin}/tours`, { headers: { Cookie: "tripanza_session=fixture-user" } })).status, 503, "Ordinary signed-in users cannot bypass maintenance");
  for (const route of ["/contact", "/privacy-policy", "/login", "/api/account"]) assert.equal((await fetch(origin + route)).status, 200, `${route} remains accessible`);
  assert.equal((await fetch(`${origin}/api/payment/payu/callback?booking_id=42&token=fixture`, { redirect: "manual" })).status, 303, "Existing payment callback still works");
  assert.equal((await fetch(`${origin}/api/cart`, { method: "POST", headers: { ...headers, Cookie: "tripanza_session=fixture-user" }, body: "{}" })).status, 503);
  await saveSettings(savedBaseline);
  assert.equal((await fetch(`${origin}/tours`)).status, 200, "Site recovers after maintenance disable");
  await page.goto(`${origin}/admin/settings`);
  await page.getByRole("heading", { name: /Your site/ }).waitFor();
  console.log("PASS: real 503 maintenance boundary, sanitized custom message, forged-header rejection, verified admin bypass, login/legal/account/payment recovery and maintenance-off restoration");
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
