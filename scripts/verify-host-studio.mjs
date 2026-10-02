// Transport/security regression checks. Optional PHP/browser tools live outside
// app dependencies: node scripts/verify-host-studio.mjs --modules=<node_modules>
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import vm from "node:vm";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(import.meta.url);
const ts = require("typescript");
const moduleRoot = process.argv.find(arg => arg.startsWith("--modules="))?.slice(10) || path.join(os.tmpdir(), "tripanza-studio-validation", "node_modules");
const validationRequire = createRequire(path.join(moduleRoot, "fixture.cjs"));
const parser = validationRequire("php-parser");
const { chromium } = validationRequire("@playwright/test");
const source = file => fs.readFileSync(path.join(root, file), "utf8");

for (const file of ["tripanza-headless-studio.php", "templates/posters.php", "templates/trips.php"]) {
  new parser.Engine({ parser: { version: "7.4", suppressErrors: false } }).parseCode(source(`wordpress/tripanza-headless-studio/${file}`), file);
}

// CSS, all prompt-generation rules, and every original form field must survive.
const posters = source("wordpress/tripanza-headless-studio/templates/posters.php");
const trips = source("wordpress/tripanza-headless-studio/templates/trips.php");
const options = [...posters.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]);
assert.equal(options.length, 22);
for (const option of options) assert.ok(posters.includes(`class="prompt-${option}"`), `Missing full ${option} prompt`);
for (const [originalName, bundled] of [["tripanza-host-share-cards.php", posters], ["Tripanza-template-create-tour.php", trips]]) {
  const originalFile = path.resolve(root, "..", originalName);
  if (!fs.existsSync(originalFile)) continue;
  const original = fs.readFileSync(originalFile, "utf8");
  const styles = text => [...text.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1].replace(/\r\n/g, "\n"));
  assert.deepEqual(styles(bundled), styles(original), `${originalName}: CSS changed`);
  const fields = text => [...text.matchAll(/name="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(fields(bundled), fields(original), `${originalName}: a form field was removed`);
  if (originalName.includes("share-cards")) {
    const promptEngine = text => text.slice(text.indexOf('$prompt_cinematic = "'), text.indexOf('$prompt_cinematic = htmlspecialchars')).replace(/\r\n/g, "\n");
    assert.equal(promptEngine(bundled), promptEngine(original), "Poster prompt engine changed");
  }
}

function loadTS(file, replacements = {}) {
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, require: name => replacements[name] || require(name), process, URL, URLSearchParams, Response, fetch, AbortSignal };
  vm.runInNewContext(output, context, { filename: file });
  return context.exports;
}
const studio = loadTS("src/lib/host-studio.ts", { "@/lib/session": { getSessionToken: async () => undefined } });
assert.equal(studio.studioRedirect("https://evil.example/add-your-own-trip", "trips"), null);
assert.equal(studio.studioRedirect("/wp-login.php", "trips"), null);
assert.equal(studio.studioRedirect("/add-your-own-trip?tour_id=45&token=secret", "trips"), "/add-your-own-trip?tour_id=45");
assert.equal(studio.studioSearch(new URLSearchParams("tour_id=12&tripanza_host_studio=tools&action=delete")).toString(), "tour_id=12");
const originCheck = loadTS("src/lib/request-origin.ts").validRequestOrigin;
assert.ok(originCheck(new Request("http://internal:10000/api/host/studio/trips", { headers: { origin: "https://app.example", "x-forwarded-host": "app.example", "x-forwarded-proto": "https" } })));
assert.equal(originCheck(new Request("http://internal:10000/api/host/studio/trips", { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } })), false);
assert.equal(originCheck(new Request("https://app.example/api/host/studio/trips", { headers: { "sec-fetch-site": "cross-site" } })), false);
console.log("PASS: PHP 7.4 syntax, exact original CSS/fields, all 22 full prompts, redirect and origin checks");

let mode = "failure";
let posted = "";
let requests = 0;
const fixture = '<script>window.TRIPANZA_STUDIO_NONCE="fixture-nonce";</script><a id="manage" href="/add-your-own-trip?tab=manage">My Trips</a><form method="post"><input name="tour_title" required><input name="availability[0][date]" value="09/10/2026"><input name="tp_gallery_files[]" type="file" multiple><button type="submit"><span>Send trip for review</span></button></form><script>document.querySelector("form").addEventListener("submit",function(){document.querySelector("button").disabled=true;document.querySelector("button").innerHTML="Saving your trip...";});</script>';
const server = http.createServer(async (req, res) => {
  if (req.url === "/host-studio-bridge.js") { res.setHeader("Content-Type", "text/javascript"); res.end(source("public/host-studio-bridge.js")); return; }
  if (req.method === "POST") {
    requests++;
    posted = "";
    for await (const chunk of req) posted += chunk;
    if (mode === "failure") { res.writeHead(503, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: false, data: "Temporary test failure" })); }
    else if (mode === "redirect") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ redirect: "/add-your-own-trip?tour_id=45&updated=true" })); }
    else { res.writeHead(200, { "Content-Type": "text/html" }); res.end("<!doctype html><p>Saved fixture</p>"); }
    return;
  }
  const html = studio.studioHTML(fixture, "trips", new URLSearchParams());
  res.setHeader("Content-Type", "text/html");
  res.end(`<html><body><iframe id="studio" sandbox="allow-scripts allow-same-origin allow-forms allow-modals" srcdoc="${html.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></iframe><script>window.messages=[];window.addEventListener('message',e=>{if(e.source===document.querySelector('iframe').contentWindow&&e.origin===location.origin)window.messages.push(e.data)});</script></body></html>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.TRIPANZA_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/fixture`);
  await page.waitForFunction(() => window.messages.some(message => message.type === "ready"));
  const frame = page.frameLocator("#studio");
  await frame.locator("#manage").click();
  await page.waitForFunction(() => window.messages.some(message => message.path === "/add-your-own-trip?tab=manage"));
  await frame.locator("input[name=tour_title]").fill("Browser transport trip");
  await frame.locator('input[type=file]').setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: Buffer.from("test") });
  await frame.locator("button").click();
  await frame.locator("#tripanza-studio-save-error").waitFor();
  assert.equal(await frame.locator("input[name=tour_title]").inputValue(), "Browser transport trip");
  assert.equal(await frame.locator("button").innerText(), "Send trip for review");
  assert.ok(posted.includes('name="availability[0][date]"'));
  assert.ok(posted.includes('name="tp_gallery_files[]"; filename="fixture.png"'));
  assert.equal(requests, 1);
  const child = page.frames().find(item => item.parentFrame());
  await child.evaluate(async () => { await window.fetch("/api/host/studio/tools", { method: "POST", body: "action=tripanza_clear_tour_cache&post_id=12" }); });
  assert.ok(posted.includes("studio_nonce=fixture-nonce"));
  mode = "redirect";
  await frame.locator("button").click();
  await page.waitForFunction(() => window.messages.some(message => message.type === "navigate" && message.replace && message.path.includes("tour_id=45")));
  mode = "document";
  await frame.locator("button").evaluate(button => { button.disabled = false; });
  await frame.locator("button").click();
  await page.waitForFunction(() => window.messages.some(message => message.type === "document" && message.html.includes("Saved fixture")));
  assert.deepEqual(errors, []);
  console.log("PASS: browser srcdoc origin, in-app tabs, AJAX multipart/files, preserved form on failure, button restore, tools nonce, save redirects and HTML replacement");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
