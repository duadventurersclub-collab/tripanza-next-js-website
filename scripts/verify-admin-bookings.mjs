// Native production UI + mock JSON WordPress. No live customer writes or mail.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import postcss from 'postcss';
const require = createRequire(import.meta.url), ts = require('typescript');
const optional = createRequire(path.join(os.tmpdir(), 'tripanza-studio-validation/node_modules/fixture.cjs'));
const PHPParser = optional('php-parser'), { chromium, expect } = optional('@playwright/test');
const read = file => fs.readFileSync(file, 'utf8');
const php = read('wordpress/tripanza-headless-admin/includes/bookings.php');
new PHPParser.Engine({ parser: { version: '7.4', suppressErrors: false } }).parseCode(php, 'bookings.php');
for (const check of ['tripanza_native_admin_permission', 'wp_verify_nonce', 'tripanza_native_bookings', 'DELETE PERMANENTLY', '!$booking[\'archived\']', 'tripanza_native_booking_lock_', 'hash_equals', 'failed_ids', 'st_order', 'get_post_type($item)', 'finally']) assert.ok(php.includes(check), check);
for (const file of ['src/components/admin/AdminBookings.tsx', 'src/components/admin/AdminBookingDetails.tsx', 'src/app/admin/bookings/page.tsx']) assert.ok(!read(file).includes('<iframe'), 'Must not embed: ' + file);
const declarations = css => { const result = []; postcss.parse(css).walkDecls(d => result.push([d.prop, d.value])); return result; };
const source = read('../tripanza-global-booking-history-admins.php');
assert.deepEqual(declarations(read('src/components/admin/admin-bookings-original.css')), declarations([...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')));
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(read('src/lib/admin-bookings-types.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const make = (id, overrides = {}) => ({ id, item_id: id, revision: 'rev-' + id, editable: true, archived: false, archived_at: '', date: '2026-10-12', departure: '12 October 2026 - 10:00 AM', checkout: '2026-10-15', duration: '3 days', title: 'Manali Atal Sissu', trip_label: 'Manali Atal Sissu - Tripanza direct', source: 'Tripanza direct', poster: 'admin', host: '', owner: 'Tripanza', inventory_id: 10, storefront_id: 10, trip_url: '/tours/manali', inventory_url: '/tours/manali', edit_url: 'https://tripanza.com/single-booking-edit/?order_id=' + id, invoice_url: 'https://tripanza.com/booking-invoice/' + id, customer: 'Traveller ' + id, email: 'fixture@example.test', phone: '919876543210', guests: ['Mr Guest One', 'Ms Guest Two'], male: 1, female: 1, quad: 2, triple: 1, twin: 0, persons: 3, sharing: 'Quad 2, Triple 1', addons: [{ key: 'extra:Rafting', label: 'Rafting', qty: 2, unit: 'Person', price: 1000, detail: '' }], currency: 'INR', total: 12000, advance: 5000, balance: 7000, adjustment: 0, status_key: 'partial', status: 'Partially Paid', payment_status: 'Paid', transaction_id: 'TXN12345678', transaction_date: '2026-10-01', note: 'Window seat if available', boarding: 'Delhi', dropoff: 'Delhi', ...overrides });
let state = { bookings_api_version: '1.0.0', user: { name: 'Fixture Admin' }, nonce: 'fixture-bookings-nonce', today: '2026-10-03', rows: [make(101), make(102, { title: 'Spiti Valley', trip_label: 'Spiti Valley - Host sale: Adventure Host', source: 'Host sale', poster: 'host', host: 'Adventure Host', status: 'Fully Paid', status_key: 'complete', advance: 12000, balance: 0 }), make(103, { status: 'Cancelled', status_key: 'cancelled' }), make(104, { date: '2025-10-12', departure: '12 October 2025' })], archived: [make(201, { archived: true, archived_at: '2026-10-01 10:00:00' })], statuses: { pending: 'On-Hold', partial: 'Partially Paid', incomplete: 'Incomplete', cancelled: 'Cancelled', complete: 'Fully Paid', refunded: 'Refunded' }, total: 5, archive_total: 1, page: 1, per_page: 1000, mail_available: true };
assert.equal(context.exports.bookingAnalytics(state.rows, 2026, '2026', 'all').count, 2);
assert.equal(context.exports.bookingAnalytics(state.rows, 2026, '2026', 'all').total, 24000);
assert.equal(context.exports.bookingAnalytics(state.rows, 2026, '2026', 'all').previous[9], 12000);
assert.equal(context.exports.bookingSummary(state.rows).quadRooms, 2);
assert.ok(context.exports.bookingMatches(state.rows[0], '12-10-2026', '', '', ''));
assert.ok(context.exports.coordinatorMessage([state.rows[0]]).includes('Balance to collect'));
assert.ok(!context.exports.coordinatorMessage([state.rows[1]]).includes('Balance to collect'));
console.log('PASS PHP 7.4 syntax, protected mutations, original CSS declaration parity, totals/rooms/analytics/WhatsApp contract');
let failAction = '', missing = false; const requests = [], actions = [];
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture'), route = url.pathname.replace('/wp-json/tripanza-headless/v1/', '');
  const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(data)); };
  requests.push({ route, method: req.method });
  if (route === 'settings/public') return send({ host_enabled: true, public_cache_enabled: false, maintenance_enabled: false, announcement_enabled: false });
  if (route.startsWith('admin/')) {
    const auth = req.headers.authorization?.replace('Bearer ', '');
    if (!auth) return send({ message: 'Please sign in.' }, 401);
    if (auth !== 'fixture-admin') return send({ message: 'Administrator access required.' }, 403);
    if (route === 'admin/identity') return send({ name: 'Fixture Admin', api_version: '2.0.0' });
    if (route !== 'admin/bookings') return send({ message: 'Not found.' }, 404);
    if (missing) return send({ message: 'Update Tripanza Native Admin API to v2.1.0 in WordPress.' }, 404);
    assert.ok(url.searchParams.has('_tripanza_live')); assert.equal(req.headers['cache-control'], 'no-cache, no-store');
    if (req.method === 'GET') return send(state);
    let raw = ''; for await (const chunk of req) raw += chunk;
    const data = JSON.parse(raw); actions.push(data);
    if (data.nonce !== state.nonce) return send({ message: 'Session expired.' }, 403);
    await new Promise(resolve => setTimeout(resolve, 120));
    if (failAction === data.action) { failAction = ''; return send({ message: 'Fixture save failed.' }, 409); }
    const ids = data.ids || [data.id], all = [...state.rows, ...state.archived], updated = [];
    for (const id of ids) {
      let row = all.find(row => row.id === id); if (!row) return send({ message: 'Booking missing.' }, 404);
      if (!data.ids && data.revision !== row.revision) return send({ message: 'This booking changed. Refresh before editing it again.' }, 409);
      row = { ...row, revision: 'rev-' + Date.now() };
      if (data.action === 'status') { row.status_key = data.status; row.status = state.statuses[data.status]; }
      if (data.action === 'adjustment') { row.adjustment = Number(data.amount); row.total += Number(data.amount); row.balance += Number(data.amount); }
      if (data.action === 'archive') { row.archived = true; row.archived_at = '2026-10-03 13:00:00'; state.archive_total++; }
      if (data.action === 'restore') { row.archived = false; state.archive_total--; }
      if (data.action === 'purge') { if (!row.archived || data.confirmation !== 'DELETE PERMANENTLY') return send({ message: 'Confirmation required.' }, 400); state.archive_total--; state.total--; }
      else updated.push(row);
    }
    state.rows = [...state.rows.filter(row => !ids.includes(row.id)), ...updated.filter(row => !row.archived)]; state.archived = [...state.archived.filter(row => !ids.includes(row.id)), ...updated.filter(row => row.archived)];
    return send({ ok: true, ids, rows: updated, nonce: state.nonce, failed_ids: [], warning: '', message: data.action === 'resend' ? 'Booking email sent.' : `${ids.length} booking(s) updated.` });
  }
  if (route === 'account') return send({ id: 1, roles: ['administrator'], name: 'Fixture Admin', email: 'fixture@example.test', bookings: [], wallet: { balance: 0 } });
  if (route === 'tours') return send({ items: [], total: 0 });
  if (route === 'meta-reels') return send({ items: [] });
  return send({ message: 'Not found.' }, 404);
});
await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.BOOKINGS_TEST_PORT || 3041), origin = `http://127.0.0.1:${port}`;
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { env: { ...process.env, WORDPRESS_URL: `http://127.0.0.1:${mock.address().port}`, NEXT_PUBLIC_SITE_URL: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser; app.stdout.on('data', data => logs += data); app.stderr.on('data', data => logs += data);
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/api/settings/public')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); if (i === 99) throw Error(logs); }
  const headers = { Cookie: 'tripanza_session=fixture-admin', Origin: origin, 'Content-Type': 'application/json' };
  const post = (data, overrides = {}) => fetch(origin + '/api/admin/bookings', { method: 'POST', headers: { ...headers, ...overrides }, body: JSON.stringify(data) });
  assert.equal((await fetch(origin + '/api/admin/bookings')).status, 401);
  assert.equal((await fetch(origin + '/api/admin/bookings', { headers: { Cookie: 'tripanza_session=fixture-user' } })).status, 403);
  assert.equal((await post({ action: 'status' }, { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await post({ action: 'not_allowed' })).status, 400);
  assert.equal((await post({ action: 'status', nonce: 'bad' })).status, 403);
  assert.equal((await post({ action: 'status', value: 'x'.repeat(21000) })).status, 413);
  assert.equal((await fetch(origin + '/api/admin/bookings?page=NaN', { headers })).status, 400);
  assert.equal((await fetch(origin + '/api/admin/bookings', { headers })).headers.get('cache-control'), 'private, no-store, max-age=0');
  const html = await (await fetch(origin + '/admin/bookings', { headers })).text(); assert.ok(html.includes('Global Booking History')); assert.ok(!html.includes('<iframe')); assert.ok(!html.includes('fixture-admin'));
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.addCookies([{ name: 'tripanza_session', value: 'fixture-admin', domain: '127.0.0.1', path: '/' }]);
  const page = await ctx.newPage(), errors = [], navigations = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', req => { if (req.isNavigationRequest() && req.frame() === page.mainFrame()) navigations.push(req.url()); });
  await page.goto(origin + '/admin/bookings');
  const rows = page.locator('#tzBookingHistoryTable tbody tr.order-row'); await expect(rows).toHaveCount(4); await expect(page.locator('#tzValConfirmed')).toHaveText('2');
  const before = requests.length, navBefore = navigations.length;
  await page.locator('#titleSearchInput').fill('Spiti'); await expect(rows).toHaveCount(1); await expect(page.locator('#tzValConfirmed')).toHaveText('1');
  await page.locator('#titleSearchInput').fill(''); await page.locator('#searchInput').fill('12-10-2026'); await expect(rows).toHaveCount(3); await page.locator('#searchInput').fill('');
  await page.locator('#statusSearchInput').selectOption('Cancelled'); await expect(rows).toHaveCount(1); await page.locator('#statusSearchInput').selectOption('');
  assert.equal(requests.length, before, 'Filters must be local'); assert.equal(navigations.length, navBefore, 'Filters must not navigate');
  await page.locator('.toggle-buttons button[data-col="5"]').click(); await expect(rows.first().locator('td').nth(5)).toBeHidden();
  await page.reload(); await expect(rows.first().locator('td').nth(5)).toBeHidden(); await page.locator('#showAll').click();
  const tripWidth = await page.locator('#tzBookingHistoryTable col').nth(3).evaluate(col => col.style.width);
  await page.getByRole('button', { name: 'Resize Trip column', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tzBookingHistoryTable col').nth(3)).toHaveAttribute('style', `width: ${parseInt(tripWidth, 10) + 10}px;`);
  await rows.first().getByRole('button', { name: 'Details', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('dialog')).toContainText('Customer & travellers'); await expect(page.locator('iframe')).toHaveCount(0); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  const first = page.locator('#tzBookingHistoryTable tr[data-order-id="101"]');
  failAction = 'status'; await first.getByLabel('Booking #101 status').selectOption('cancelled'); await expect(page.locator('.nb-notice')).toContainText('Fixture save failed'); await expect(first.getByLabel('Booking #101 status')).toHaveValue('partial');
  await first.getByLabel('Booking #101 status').selectOption('complete'); await expect(first.locator('.status-display')).toHaveText('Fully Paid');
  await first.getByLabel('Booking #101 adjustment').fill('-100'); await first.getByRole('button', { name: 'Update', exact: true }).click(); await expect(first.locator('td').nth(8)).toHaveText('11,900.00');
  await first.getByRole('button', { name: 'Resend Email' }).click(); await expect(page.locator('.nb-notice')).toContainText('Booking email sent');
  await first.getByLabel('Select booking #101').check(); page.once('dialog', dialog => dialog.accept()); await page.locator('#tzBulkDeleteBtn').click(); await expect(first).toHaveCount(0);
  await page.getByRole('button', { name: /^Archive/ }).click(); const archived = page.locator('#tzArchiveWorkspace tr[data-order-id="101"]'); await expect(archived).toHaveCount(1);
  await archived.getByLabel('Select archived booking #101').check(); page.once('dialog', dialog => dialog.accept()); await page.locator('#tzBulkRestoreBtn').click(); await expect(archived).toHaveCount(0);
  const archived201 = page.locator('#tzArchiveWorkspace tr[data-order-id="201"]'); await archived201.getByLabel('Select archived booking #201').check();
  const actionCount = actions.length; page.once('dialog', dialog => dialog.dismiss()); await page.locator('#tzBulkPurgeBtn').click(); assert.equal(actions.length, actionCount, 'Cancel must not delete');
  page.once('dialog', dialog => dialog.accept('DELETE PERMANENTLY')); await page.locator('#tzBulkPurgeBtn').click(); await expect(archived201).toHaveCount(0);
  await page.getByRole('button', { name: 'Active', exact: true }).click(); await expect(rows).toHaveCount(4);
  await page.locator('#customText').fill('Fixture PDF note - coordinator copy');
  const download = page.waitForEvent('download'); await page.locator('#exportButton').click(); const pdf = await download;
  const out = path.join(os.tmpdir(), 'tripanza-booking-verification'); fs.mkdirSync(out, { recursive: true }); await pdf.saveAs(path.join(out, 'booking-report.pdf')); assert.ok(fs.statSync(path.join(out, 'booking-report.pdf')).size > 5000);
  await page.evaluate(() => { window.__wa = ''; window.open = url => { window.__wa = url; return null; }; }); await page.locator('#coordinatorPhone').fill('9876543210'); await page.locator('#whatsappShareButton').click(); assert.ok((await page.evaluate(() => window.__wa)).startsWith('https://wa.me/919876543210?text='));
  await page.getByRole('button', { name: 'Dismiss notice' }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: path.join(out, 'bookings-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await expect(rows.first()).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Mobile page must not overflow horizontally');
  assert.ok(await rows.first().evaluate(row => row.getBoundingClientRect().width <= window.innerWidth), 'Mobile card values must remain on screen');
  const partial = page.locator('#tzBookingHistoryTable tr[data-order-id="104"] .status-display');
  assert.equal(await partial.evaluate(cell => getComputedStyle(cell).backgroundColor), 'rgb(16, 205, 120)', 'Status colour must survive mobile card styles');
  await page.locator('.toggle-buttons button[data-col="5"]').click(); await expect(rows.first().locator('td').nth(5)).toBeHidden(); await page.locator('#showAll').click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: path.join(out, 'bookings-mobile.png'), fullPage: true });
  await rows.first().screenshot({ path: path.join(out, 'bookings-mobile-row.png') });
  assert.equal(navigations.length, navBefore + 1, 'Only the deliberate reload navigates');
  assert.deepEqual(errors, []);
  state.rows = Array.from({ length: 120 }, (_, i) => make(1000 + i)); state.total = 120;
  await page.getByRole('button', { name: 'Refresh bookings', exact: true }).click(); await expect(rows).toHaveCount(120);
  const stressDownload = page.waitForEvent('download'); await page.locator('#exportButton').click();
  await (await stressDownload).saveAs(path.join(out, 'booking-report.pdf'));
  const guest = await browser.newContext(); const gp = await guest.newPage(); await gp.goto(origin + '/admin/bookings'); await expect(gp).toHaveURL(origin + '/'); await guest.addCookies([{ name: 'tripanza_session', value: 'fixture-user', domain: '127.0.0.1', path: '/' }]); await gp.goto(origin + '/admin/bookings'); await expect(gp).toHaveURL(origin + '/'); await guest.close();
  missing = true; await page.goto(origin + '/admin/bookings'); await expect(page.getByRole('heading', { name: 'Booking history is unavailable.' })).toBeVisible();
  console.log('PASS native booking DOM, local filters, persisted columns, details, status failure/success, adjustment, email, archive/restore/purge confirmation, PDF, WhatsApp, mobile, permissions, missing-plugin state');
  console.log('QA output: ' + out);
} finally { await browser?.close(); app.kill(); await new Promise(resolve => mock.close(resolve)); }
