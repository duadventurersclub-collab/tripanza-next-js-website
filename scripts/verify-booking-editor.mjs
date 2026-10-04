// Production Next.js browser tests with a fake WordPress JSON server. No live writes.
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
const { chromium, expect } = optional('@playwright/test'), PHPParser = optional('php-parser');
const read = file => fs.readFileSync(file, 'utf8');
for (const file of ['booking-editor.php', 'booking-editor-calculations.php', 'bookings.php']) new PHPParser.Engine({ parser: { version: '7.4', suppressErrors: false } }).parseCode(read('wordpress/tripanza-headless-admin/includes/' + file), file);
const declarations = css => { const result = []; postcss.parse(css).walkDecls(d => result.push([d.prop, d.value])); return result; };
const reference = read('../St-tour page and bookings and cart/single-booking-edit-page.php');
assert.deepEqual(declarations(read('src/components/admin/booking-editor-original.css')), declarations([...reference.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')));
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(read('src/lib/admin-booking-editor-types.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { editorPreview } = context.exports;
let revision = 1, fail = '', missing = false, readonly = false; const actions = [], gets = [], receipts = new Map();
let state = { editor_api_version: '1.0.0', user: { name: 'Fixture Admin' }, nonce: 'fixture-nonce', revision: 'rev-1', booking: { id: 101, item_id: 101, revision: 'rev-1', editable: true, archived: false, archived_at: '', date: '2026-10-12', departure: '12 October 2026', checkout: '2026-10-15', duration: '3 days', title: 'Manali', trip_label: 'Manali - Tripanza direct', source: 'Tripanza direct', poster: 'admin', host: '', owner: 'Tripanza', inventory_id: 10, storefront_id: 10, trip_url: '/tours/manali', inventory_url: '/tours/manali', edit_url: 'https://fixture.test/single-booking-edit/?order_id=101', invoice_url: 'https://fixture.test/invoice', customer: 'Fixture Guest', email: 'guest@example.test', phone: '919876543210', guests: ['Mr Fixture Guest'], male: 1, female: 0, quad: 2, triple: 0, twin: 0, persons: 2, sharing: 'Quad 2', addons: [], currency: 'INR', total: 2000, advance: 500, balance: 1500, adjustment: 0, status_key: 'partial', status: 'Partially Paid', payment_status: 'Paid', transaction_id: '', transaction_date: '', note: '', boarding: 'Delhi', dropoff: 'Delhi' },
  fields: { selected_tour_id: 10, selected_tour_name: 'Manali', boarding: 'Delhi', dropoff: 'Delhi', departure_date: '2026-10-12', return_date: '2026-10-15', starttime: '10:00 AM', duration: '3 days', adult_number: 2, child_number: 0, infant_number: 0, guests: [{ title: 'Mr', name: 'Fixture Guest', age: 25 }], addons: [{ title: 'Rafting', price: 100, quantity: 2 }], st_first_name: 'Fixture', st_last_name: 'Guest', st_phone: '9876543210', st_email: 'guest@example.test', st_city: 'Delhi', st_note: 'Window seat', total_price: 500, transaction_id: '', transaction_date: '', balance_transaction_id: '', balance_transaction_date: '' },
  financials: { base_total: 2000, booking_fee: 0, tax_percent: 5, adjustment: 0, adjustment_tax: 0, raw_final_total: 2000, final_total: 2000, amount_paid: 500, balance: 1500, overpayment: 0, status: 'partial' }, pricing: { prices: { adult: 1000, child: 1200, infant: 1500 }, sale_rate: 10, sale_type: 'percent', bulk_type: 'percent', adult_rules: [{ key: 3, value: 5 }], child_rules: [], saved_group_discount: 0 }, auto_adjustment: 0, manual_total: 0, ledger: [], created: '4 Oct 2026', payment_method: 'PayU', country_code: '91', status_label: 'Partially Paid', statuses: { partial: 'Partially Paid', complete: 'Fully Paid', cancelled: 'Cancelled' }, host_name: 'Tripanza', coupon_code: 'WALLET', coupon_amount: 100, packages: [{ label: 'Equipment', amount: 50 }], tax_included: false, payment_urls: { payu: 'https://fixture.test/payu', upi: 'https://fixture.test/upi' }, mail_available: true, whatsapp_available: true, wallet: { reversed: false, used: 100, can_reverse: true }, readonly: false };
const initial = structuredClone(state);
assert.equal(editorPreview(state, { ...state.fields, adult_number: 3, addons: [{ title: 'Rafting', price: 100, quantity: 3 }] }, { type: 'charge', amount: 100 }).total, 3013.25);
assert.equal(editorPreview(state, state.fields, { type: 'credit', amount: .1 }).total, 1999.89, 'Negative half-cent GST must round like PHP');
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture'), route = url.pathname.replace('/wp-json/tripanza-headless/v1/', '');
  const send = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(value)); };
  if (route === 'settings/public') return send({ host_enabled: true, public_cache_enabled: false, maintenance_enabled: false, announcement_enabled: false });
  if (route.startsWith('admin/')) {
    const auth = req.headers.authorization?.replace('Bearer ', ''); if (!auth) return send({ message: 'Please sign in.' }, 401); if (auth !== 'fixture-admin') return send({ message: 'Administrator access required.' }, 403);
    if (route === 'admin/identity') return send({ name: 'Fixture Admin', api_version: '2.0.0' });
    if (route === 'admin/bookings') { gets.push(route); return send({ bookings_api_version: '1.0.0', user: state.user, nonce: state.nonce, today: '2026-10-04', rows: [{ ...state.booking, created_at: '2026-10-04' }], archived: [], statuses: state.statuses, total: 1, archive_total: 0, page: 1, per_page: 1000, mail_available: true }); }
    if (route !== 'admin/bookings/101/editor') return send({ message: 'Missing booking.' }, 404);
    if (missing) return send({ message: 'Update plugin.' }, 404);
    assert.ok(url.searchParams.has('_tripanza_live')); assert.equal(req.headers['cache-control'], 'no-cache, no-store');
    if (req.method === 'GET') { gets.push(route); if (url.searchParams.has('search')) return send({ tours: [{ id: 11, name: 'Spiti Valley' }] }); return send({ ...state, readonly }); }
    let raw = ''; for await (const chunk of req) raw += chunk; const body = JSON.parse(raw); actions.push(body);
    assert.equal(body.nonce, state.nonce); await new Promise(resolve => setTimeout(resolve, fail === body.action ? 500 : 80));
    if (fail === body.action) { fail = ''; return send({ message: 'Fixture save failed. Please refresh.' }, 409); }
    if (receipts.has(body.request_id)) return send({ ok: true, editor: state, message: 'Already completed, no duplicate.' });
    if (body.revision !== state.revision) return send({ message: 'Booking changed. Refresh before saving.' }, 409);
    if (body.action === 'save') {
      const preview = editorPreview(state, body.fields, body.manual); if (preview.rawTotal < 0) return send({ message: 'Credit exceeds total.' }, 422);
      state = { ...state, fields: structuredClone(body.fields), auto_adjustment: preview.auto, manual_total: preview.manualTotal, financials: { ...state.financials, adjustment: preview.adjustment, adjustment_tax: preview.tax, raw_final_total: preview.rawTotal, final_total: preview.total, amount_paid: body.fields.total_price, balance: preview.balance } };
      if (body.manual.amount > 0) state.ledger.push({ id: body.request_id, type: body.manual.type, amount: body.manual.amount, tax: body.manual.amount * .05, total_effect: body.manual.amount * 1.05, customer_reason: body.manual.reason, internal_note: body.manual.internal_note, created_at: '2026-10-04 12:00:00', user_name: 'Fixture Admin' });
      state.booking = { ...state.booking, total: preview.total, advance: body.fields.total_price, balance: preview.balance, title: body.fields.selected_tour_name, boarding: body.fields.boarding };
    } else if (body.action === 'status') { state.booking.status_key = body.status; state.booking.status = state.statuses[body.status]; state.status_label = state.booking.status; }
    else if (body.action === 'reverse_wallet') { assert.equal(body.confirmation, 'REVERSE WALLET'); state.wallet = { ...state.wallet, reversed: true, can_reverse: false }; }
    state.revision = 'rev-' + ++revision; receipts.set(body.request_id, true);
    if (fail === 'lost-response') { fail = ''; return send({ message: 'Simulated lost confirmation.' }, 502); }
    return send({ ok: true, editor: state, message: body.action === 'save' ? 'All details updated successfully!' : 'Action confirmed.' });
  }
  if (route === 'account') return send({ id: 1, roles: ['administrator'], name: 'Fixture Admin', email: 'fixture@example.test', bookings: [], wallet: { balance: 0 } });
  if (route === 'tours' || route === 'meta-reels') return send({ items: [], total: 0 });
  return send({ message: 'Not found.' }, 404);
});
await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.EDITOR_TEST_PORT || 3042), origin = `http://127.0.0.1:${port}`;
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { env: { ...process.env, WORDPRESS_URL: `http://127.0.0.1:${mock.address().port}`, NEXT_PUBLIC_SITE_URL: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser; app.stdout.on('data', data => logs += data); app.stderr.on('data', data => logs += data);
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/api/settings/public')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); if (i === 99) throw Error(logs); }
  const endpoint = origin + '/api/admin/bookings/101/editor', headers = { Cookie: 'tripanza_session=fixture-admin', Origin: origin, 'Content-Type': 'application/json' };
  const post = (data, overrides = {}) => fetch(endpoint, { method: 'POST', headers: { ...headers, ...overrides }, body: JSON.stringify(data) });
  assert.equal((await fetch(endpoint)).status, 401); assert.equal((await fetch(endpoint, { headers: { Cookie: 'tripanza_session=fixture-user' } })).status, 403);
  assert.equal((await post({ action: 'save' }, { Origin: 'https://evil.test', 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await post({ action: 'delete' })).status, 400); assert.equal((await post({ action: 'save', content: 'x'.repeat(270000) })).status, 413);
  assert.equal((await fetch(endpoint + '?search=a', { headers })).status, 400); assert.equal((await fetch(endpoint, { headers })).headers.get('cache-control'), 'private, no-store, max-age=0');
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await ctx.addCookies([{ name: 'tripanza_session', value: 'fixture-admin', domain: '127.0.0.1', path: '/' }]);
  const page = await ctx.newPage(), errors = [], documents = []; page.on('pageerror', error => errors.push(error.message)); page.on('request', req => { if (req.isNavigationRequest() && req.frame() === page.mainFrame()) documents.push(req.url()); });
  await page.goto(origin + '/admin/bookings'); const historyRow = page.locator('#tzBookingHistoryTable tr[data-order-id="101"]');
  await page.locator('#searchInput').fill('101'); await historyRow.getByLabel('Select booking #101').check(); await page.locator('#customText').fill('Keep my report note');
  await historyRow.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await expect(page).toHaveURL(origin + '/admin/bookings'); await expect(page.getByRole('heading', { name: 'Edit booking #101', exact: true, level: 1 })).toBeVisible();
  assert.equal(documents.length, 1, 'Edit must open over history without navigating'); await expect(page.locator('iframe')).toHaveCount(0); assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.getByRole('button', { name: 'Close booking editor', exact: true }).focus(); await page.keyboard.press('Shift+Tab'); assert.ok(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog'))), 'Native dialog traps focus');
  for (const section of ['Trip & Locations', 'Schedule & Duration', 'Traveller Quantities', 'Traveller Details', 'Optional Add-ons', 'Lead Traveller & Contact', 'Payment & Adjustments']) await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible();
  await expect(page.locator('.order-actions-section h3')).toContainText('Order Actions');
  for (const field of ['#tour_search', '#selected_tour_name', '[name="guest_name[0]"]', '#manual_adjustment_reason', '#manual_adjustment_internal_note', '[name="st_phone"]']) assert.ok(await page.locator(field).evaluate(el => el.getBoundingClientRect().height >= 40), 'Native inputs must retain reference styling: ' + field);
  await page.locator('#tour_search').fill('Spiti'); await page.getByRole('button', { name: 'Spiti Valley', exact: true }).click(); await expect(page.locator('#selected_tour_name')).toHaveValue('Spiti Valley');
  await page.locator('[name="adult_number"]').fill('3'); await expect(page.locator('[name="addon_quantity[0]"]')).toHaveValue('3'); await page.locator('#manual_adjustment_amount').fill('100'); await page.locator('#manual_adjustment_reason').fill('Room upgrade'); await page.locator('#manual_adjustment_internal_note').fill('Fixture internal'); await expect(page.locator('#booking-total-preview')).toContainText('3,013.25');
  await page.locator('[name="boarding"]').fill('Fixture pickup'); await page.locator('#addGuestBtn').click(); await page.locator('[name="guest_name[1]"]').fill('Second Guest'); await page.locator('#addAddonBtn').click(); await page.getByRole('button', { name: 'Remove add-on 2', exact: true }).click();
  fail = 'save'; await page.locator('#save-all-btn').click(); await page.getByRole('button', { name: 'Close booking editor', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.locator('.be-notice')).toContainText('Fixture save failed'); await expect(page.locator('[name="boarding"]')).toHaveValue('Fixture pickup'); await expect(page.locator('#manual_adjustment_amount')).toHaveValue('100');
  fail = 'lost-response'; await page.locator('#save-all-btn').click(); await expect(page.locator('.be-notice')).toContainText('Simulated lost confirmation'); const attempt = actions.at(-1).request_id;
  await page.locator('#save-all-btn').click(); await expect(page.locator('.be-notice')).toContainText('Already completed'); assert.equal(actions.at(-1).request_id, attempt); assert.equal(state.ledger.length, 1); await expect(page.locator('#manual_adjustment_amount')).toHaveValue('0'); await expect(page.locator('#boarding-pass-wrapper')).toContainText('Fixture pickup'); await expect(page.locator('#manual-adjustment-history')).toContainText('Room upgrade');
  const status = page.locator('.be-modal-dialog .admin-order-status'); fail = 'status'; await status.selectOption('complete'); await expect(page.locator('.be-notice')).toContainText('Fixture save failed'); await expect(status).toHaveValue('partial'); await status.selectOption('complete'); await expect(status).toHaveValue('complete');
  assert.equal(state.financials.balance, 2513.25, 'Completed advance must retain outstanding balance');
  await expect(page.locator('#boarding-pass-wrapper .booking-fare__row--balance')).toContainText('2,513.25');
  const count = actions.length; page.once('dialog', d => d.dismiss()); await page.locator('.be-modal-dialog').getByRole('button', { name: 'Resend Email', exact: true }).click(); assert.equal(actions.length, count); page.once('dialog', d => d.accept()); await page.locator('.be-modal-dialog').getByRole('button', { name: 'Resend Email', exact: true }).click(); await expect(page.locator('.be-notice')).toContainText('Action confirmed');
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Share on WhatsApp', exact: true }).click(); await expect(page.locator('.be-notice')).toContainText('Action confirmed'); assert.equal(actions.at(-1).action, 'whatsapp');
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Reverse Wallet / Coupon', exact: true }).click(); await expect(page.getByRole('button', { name: 'Wallet already reversed', exact: true })).toBeDisabled();
  await page.locator('[name="boarding"]').fill('Discard me'); page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'Close booking editor', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await expect(page).toHaveURL(origin + '/admin/bookings'); page.once('dialog', d => d.dismiss()); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeVisible(); page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Refresh saved booking', exact: true }).click(); await expect(page.locator('[name="boarding"]')).toHaveValue('Fixture pickup');
  const out = path.join(os.tmpdir(), 'tripanza-booking-editor-verification'); fs.mkdirSync(out, { recursive: true }); await page.locator('.be-modal-body').evaluate(el => el.scrollTo(0, 0)); await page.screenshot({ path: path.join(out, 'editor-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Mobile must not overflow'); const historyScroll = await page.evaluate(() => scrollY); await page.screenshot({ path: path.join(out, 'editor-mobile.png') }); await page.locator('#master-booking-form .edit-section').first().screenshot({ path: path.join(out, 'editor-mobile-form.png') });
  await page.getByRole('button', { name: '← Back to booking history', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page).toHaveURL(origin + '/admin/bookings'); await expect(page.locator('#tzBookingHistoryTable tr[data-order-id="101"]')).toContainText('3,013.25'); await expect(page.locator('#searchInput')).toHaveValue('101'); await expect(historyRow.getByLabel('Select booking #101')).toBeChecked(); await expect(page.locator('#customText')).toHaveValue('Keep my report note'); assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden'); assert.equal(documents.length, 1, 'Modal actions must never navigate'); assert.deepEqual(errors, []);
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - historyScroll) <= 2, 'Closing the modal must preserve history scroll position');
  await expect(historyRow.locator('td').nth(10)).toContainText('2,513.25');
  await expect(historyRow.locator('td').nth(10)).not.toContainText('Zero Balance');
  await historyRow.getByRole('button', { name: 'Details', exact: true }).click(); await page.getByRole('button', { name: 'Open full booking editor', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(1); await expect(page.getByRole('heading', { name: 'Edit booking #101', exact: true, level: 1 })).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  missing = true; await historyRow.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('Update plugin.'); missing = false; await page.getByRole('button', { name: 'Retry loading booking', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Edit booking #101', exact: true, level: 1 })).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(origin + '/single-booking-edit?order_id=101'); await expect(page).toHaveURL(origin + '/admin/bookings/101/edit'); readonly = true; await page.reload(); await expect(page.locator('#save-all-btn')).toBeDisabled();
  const guest = await browser.newContext(); const gp = await guest.newPage(); await gp.goto(origin + '/admin/bookings/101/edit'); await expect(gp).toHaveURL(origin + '/'); await guest.addCookies([{ name: 'tripanza_session', value: 'fixture-user', domain: '127.0.0.1', path: '/' }]); await gp.goto(origin + '/admin/bookings/101/edit'); await expect(gp).toHaveURL(origin + '/'); await guest.close();
  missing = true; await page.reload(); await expect(page.getByRole('heading', { name: 'Booking editor is unavailable.', exact: true })).toBeVisible();
  assert.equal(initial.financials.base_total, state.financials.base_total);
  console.log('PASS PHP 7.4 syntax, original CSS parity, preview math, protected transport, modal over history/no navigation, searches/forms/save retry, actions, unsaved close/Escape guards, focus trap, filters/selection/report preservation, details-to-editor, load retry, mobile, direct URL/readonly and permissions'); console.log('QA output: ' + out);
} finally { await browser?.close(); app.kill(); await new Promise(resolve => mock.close(resolve)); }
