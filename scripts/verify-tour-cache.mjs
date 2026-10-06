// Run after npm run build. Production Next + isolated WordPress fixture; no live writes.
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let settings = { host_enabled: false, public_cache_enabled: true, tour_cache_seconds: 300,
  new_bookings_enabled: true, maintenance_enabled: false, maintenance_message: "Fixture maintenance",
  revision: "tour-test-1", cache_revision: "tour-test-1" };
let title = "Cache fixture mountain escape", outage = false;
const calls = { settings: 0, tours: 0, listings: 0, quotes: 0 };
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://fixture");
  const route = url.pathname.replace("/wp-json/tripanza-headless/v1/", "");
  const send = (body, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (route === "settings/public") {
    calls.settings++;
    await sleep(200);
    return send(url.searchParams.has("_tripanza_live") ? settings : { ...settings, revision: "stale-cdn" });
  }
  if (route === "admin/settings") {
    if (req.headers.authorization !== "Bearer fixture-admin") return send({}, 403);
    if (req.method === "POST") {
      let raw = ""; for await (const chunk of req) raw += chunk;
      settings = { ...settings, ...JSON.parse(raw) };
    }
    return send({ settings });
  }
  if (route === "booking/quote") { calls.quotes++; return send({ quote_id: `live-${calls.quotes}` }); }
  if (outage) return send({ message: "Upstream unavailable" }, 503);
  if (route === "site") return send({ name: "Tripanza Fixture", description: "Test trips", url: "http://fixture", admin_url: "", site_language: "en-IN", timezone: "Asia/Kolkata" });
  if (route === "tours") {
    calls.listings++;
    return send({ admin_only: true, items: [{ id: 42, slug: "cache-fixture", title, currency: "INR", price: "10000",
      details: { origin: "Delhi", destination: "Manali", duration: { days: "3", nights: "2" }, pricing: { quad: { amount: 10000, display: "₹10,000" } } } }] });
  }
  if (route === "tours/cache-fixture") {
    calls.tours++;
    await sleep(300);
    return send({ id: 42, slug: "cache-fixture", title: url.searchParams.has("_tripanza_live") ? title : "STALE CDN TOUR",
      content: "FULL_ITINERARY_SHOULD_NOT_SHIP",
      currency: "INR", price: "10000", details: { origin: "Delhi", duration: { days: "3", nights: "2" },
        pricing: { quad: { amount: 10000, display: "₹10,000" } }, itinerary: [{ day: 1, title: "Arrival", description: "Meet the crew." }] } });
  }
  if (route.startsWith("tours/")) return send({ code: "tripanza_tour_not_found" }, 404);
  if (url.pathname === "/wp-json/wp/v2/st_tours") return send([]);
  return send({}, 404);
});
await new Promise(resolve => mock.listen(0, "127.0.0.1", resolve));
const port = Number(process.env.TOUR_CACHE_TEST_PORT || 3041);
const origin = `http://127.0.0.1:${port}`;
const secret = "local-cache-verification-secret";
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: { ...process.env, WORDPRESS_URL: `http://127.0.0.1:${mock.address().port}`, NEXT_PUBLIC_SITE_URL: origin, REVALIDATION_SECRET: secret },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
app.stdout.on("data", chunk => { logs += chunk; }); app.stderr.on("data", chunk => { logs += chunk; });
async function page(path = "/tours/cache-fixture", headers = {}) {
  const start = performance.now();
  const response = await fetch(origin + path, { headers });
  const html = await response.text();
  return { response, html, ms: Math.round(performance.now() - start) };
}
async function invalidate(source = "wordpress", key = secret) {
  return fetch(origin + "/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json", "x-tripanza-revalidate-secret": key }, body: JSON.stringify({ source, slug: "cache-fixture" }) });
}
async function save(patch) {
  const revision = `tour-test-${Date.now()}`;
  const response = await fetch(origin + "/api/admin/settings", { method: "POST", headers: { Cookie: "tripanza_session=fixture-admin", Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ ...patch, revision, cache_revision: revision }) });
  assert.equal(response.status, 200);
  // Proxy and render worker may be separate processes. Expiry starts a
  // background refresh, then the next request observes the updated controls.
  await sleep(10_100);
  await page();
  await sleep(300);
}
try {
  for (let retry = 0; retry < 80; retry++) {
    try { if ((await fetch(origin + "/api/settings/public")).ok) break; } catch { /* Starting */ }
    await sleep(250);
    if (retry === 79) throw new Error("Next failed to start");
  }
  // Production HTML survives process restarts; reset only the test build cache.
  assert.equal((await invalidate("site-controls")).status, 200);
  const homeCold = await page("/");
  assert.equal(homeCold.response.status, 200);
  assert.ok(homeCold.html.includes(title));
  assert.ok(!homeCold.html.includes("FULL_ITINERARY_SHOULD_NOT_SHIP"));
  const homeCalls = { ...calls };
  for (let i = 0; i < 3; i++) {
    const homeWarm = await page("/");
    assert.equal(homeWarm.response.headers.get("x-nextjs-cache"), "HIT");
    assert.ok(homeWarm.html.includes(title));
  }
  assert.equal(calls.listings, homeCalls.listings);
  assert.equal(calls.tours, homeCalls.tours);
  assert.equal(calls.settings, homeCalls.settings);
  console.log(`PASS: homepage serves cached HTML at /; ${homeCold.ms}ms cold, no repeat WordPress calls or full itineraries`);
  const cold = await page();
  assert.equal(cold.response.status, 200);
  assert.ok(cold.html.includes(title));
  assert.ok(!cold.html.includes("STALE CDN TOUR"));
  const initial = { ...calls };
  const times = [];
  for (let i = 0; i < 5; i++) {
    const warm = await page(); times.push(warm.ms);
    assert.equal(warm.response.headers.get("x-nextjs-cache"), "HIT");
    assert.ok(warm.html.includes(title));
  }
  assert.equal(calls.tours, initial.tours, "Warm HTML must not fetch tour data");
  assert.equal(calls.settings, initial.settings, "Warm clicks must not wait for WordPress settings");
  console.log(`PASS: production ISR HIT; cold ${cold.ms}ms, warm ${times.join("/")}ms; zero extra WordPress calls`);
  assert.equal((await invalidate("wordpress", "wrong")).status, 401);
  title = "Updated fixture mountain escape";
  assert.equal((await invalidate()).status, 200);
  assert.ok((await page()).html.includes(title), "Tour webhook must refresh HTML and origin data");
  assert.ok((await page("/")).html.includes(title), "Tour webhook must refresh the homepage");
  console.log("PASS: signed tour webhook invalidates HTML/data, bypasses stale upstream CDN; bad secret rejected");

  const bookingBody = JSON.stringify({ tour_id: 42, date: "2027-01-01", counts: { quad: 1, triple: 0, twin: 0 }, extras: [] });
  for (let i = 1; i <= 2; i++) {
    const response = await fetch(origin + "/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: bookingBody });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).cart.quote.quote_id, `live-${i}`);
  }
  settings.new_bookings_enabled = false;
  assert.equal((await fetch(origin + "/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: bookingBody })).status, 503);
  assert.equal(calls.quotes, 2);
  settings.new_bookings_enabled = true;
  console.log("PASS: booking quotes stay live on each request; booking disable enforced immediately despite cached page");

  for (const patch of [{ public_cache_enabled: false }, { public_cache_enabled: true, tour_cache_seconds: 0 }]) {
    await save(patch);
    const before = calls.tours;
    const beforeListings = calls.listings;
    for (let i = 0; i < 2; i++) {
      const live = await page();
      assert.equal(live.response.status, 200);
      assert.ok(live.html.includes(title));
      assert.ok(live.response.headers.get("cache-control").includes("no-store"));
      const homeLive = await page("/");
      assert.equal(homeLive.response.status, 200);
      assert.ok(homeLive.html.includes(title));
      assert.ok(homeLive.response.headers.get("cache-control").includes("no-store"));
    }
    assert.ok(calls.tours >= before + 2, "Disabled cache must fetch on every page request");
    assert.ok(calls.listings >= beforeListings + 2, "Disabled homepage cache must fetch its listing every time");
  }
  console.log("PASS: public cache OFF and tour TTL=0 both use live renderer at the original URL");
  const redirect = await fetch(origin + "/tour-live/cache-fixture", { redirect: "manual" });
  assert.equal(new URL(redirect.headers.get("location"), origin).pathname, "/tours/cache-fixture");
  const homeRedirect = await fetch(origin + "/home-cache/home", { redirect: "manual" });
  assert.equal(new URL(homeRedirect.headers.get("location"), origin).pathname, "/");
  await save({ public_cache_enabled: true, tour_cache_seconds: 1 });
  await page();
  title = "Background refreshed mountain escape";
  await sleep(1200);
  const stale = await page();
  assert.equal(stale.response.status, 200);
  assert.equal(stale.response.headers.get("x-nextjs-cache"), "STALE");
  let refreshed = false;
  for (let i = 0; i < 8; i++) {
    await sleep(1100);
    if ((await page()).html.includes(title)) { refreshed = true; break; }
  }
  assert.ok(refreshed, "Expired data and HTML must refresh in the background");
  console.log("PASS: expired HTML is served immediately and refreshes in the background");
  await save({ public_cache_enabled: true, tour_cache_seconds: 300 });
  await page();
  assert.equal((await page()).response.headers.get("x-nextjs-cache"), "HIT");
  await page("/");
  assert.equal((await page("/")).response.headers.get("x-nextjs-cache"), "HIT");
  await save({ maintenance_enabled: true });
  assert.equal((await page()).response.status, 503);
  assert.equal((await page("/")).response.status, 503);
  assert.equal((await page(undefined, { Cookie: "tripanza_session=fixture-user" })).response.status, 503);
  assert.equal((await page(undefined, { Cookie: "tripanza_session=fixture-admin" })).response.status, 200);
  console.log("PASS: cache re-enable works; maintenance blocks cached pages; only verified admin bypasses");
  await save({ maintenance_enabled: false });
  outage = true;
  const failed = await page("/tours/recovery-fixture");
  assert.ok(!failed.html.includes("This page could not be found"), "An outage is not a permanent missing tour");
  outage = false;
  const missing = await page("/tours/recovery-fixture");
  assert.ok(missing.html.includes("This page could not be found"));
  assert.ok(!logs.includes("Page changed from static to dynamic"));
  console.log("PASS: upstream outage does not cache a false 404; no static-to-dynamic errors");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  app.kill();
  mock.closeAllConnections();
  await new Promise(resolve => mock.close(resolve));
}
