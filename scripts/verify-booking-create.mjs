// Production Next.js + mock WordPress JSON. Never creates a live booking.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import postcss from 'postcss';
const optional = createRequire(path.join(os.tmpdir(), 'tripanza-studio-validation/node_modules/fixture.cjs'));
const { chromium, expect } = optional('@playwright/test'), PHPParser = optional('php-parser');
const read = file => fs.readFileSync(file, 'utf8');
new PHPParser.Engine({ parser: { version: '7.4', suppressErrors: false } }).parseCode(read('wordpress/tripanza-headless-admin/includes/booking-create.php'));
const declarations = css => { const entries = []; postcss.parse(css).walkDecls(d => entries.push([d.prop, d.value])); return entries; };
assert.deepEqual(declarations(read('src/components/admin/booking-manager-original.css')), declarations([...read('../tripanza-create-edit-new-booking.php').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n')));
for (const file of ['src/components/admin/AdminBookingCreate.tsx', 'wordpress/tripanza-headless-admin/includes/booking-create.php']) assert.ok(!read(file).includes('<iframe'), 'Native, not embedded');
let missing = false, missingSource = false, failed = false, lost = false, generated = 0; const attempts = [], receipts = new Map();
const initial = { create_api_version: '1.0.0', user: { name: 'Fixture Admin' }, nonce: 'fixture-create', today: '2026-10-04', tours: [{ id: 10, name: 'Manali Atal Sissu' }, { id: 11, name: 'Spiti Private Admin Tour' }], standard_available: true, custom_available: true, custom_prerequisites: { template_exists: true, order_type_available: true, traveler_table_available: true }, custom_template_id: 27807, mail_available: true };
const editor = id => ({ editor_api_version: '1.0.0', user: initial.user, nonce: 'fixture-editor', revision: 'fixture-rev', booking: { id, title: 'Fixture Trip', currency: 'INR', source: 'Tripanza direct', status: 'On Hold', status_key: 'on-hold', trip_url: '/tours/fixture', edit_url: '/legacy', archived: false }, fields: { selected_tour_id: 10, selected_tour_name: 'Fixture Trip', boarding: 'Delhi', dropoff: 'Delhi', departure_date: '2026-11-10', return_date: '2026-11-13', duration: '3 days', starttime: '', adult_number: 2, child_number: 0, infant_number: 0, addons: [], guests: [{ name: 'Fixture Guest', title: 'mr', age: 25 }], st_first_name: 'Fixture', st_last_name: 'Guest', st_phone: '9876543210', st_email: 'guest@example.test', st_city: '', st_note: '', total_price: 500, transaction_id: '', transaction_date: '', balance_transaction_id: '', balance_transaction_date: '' }, financials: { base_total: 2000, booking_fee: 0, final_total: 2000, amount_paid: 500, balance: 1500, tax_percent: 5, adjustment: 0, adjustment_tax: 0, raw_final_total: 2000, overpayment: 0, status: 'on-hold' }, pricing: { prices: { adult: 1000, child: 0, infant: 0 }, sale_rate: 0, sale_type: 'percent', bulk_type: 'percent', adult_rules: [], child_rules: [], saved_group_discount: 0 }, auto_adjustment: 0, manual_total: 0, ledger: [], statuses: { 'on-hold': 'On Hold' }, status_label: 'On Hold', payment_method: 'offline', created: '4 Oct 2026', host_name: 'Tripanza', country_code: '91', coupon_code: '', coupon_amount: 0, packages: [], tax_included: false, payment_urls: {}, mail_available: false, whatsapp_available: false, wallet: { can_reverse: false, used: 0, reversed: false }, readonly: true });
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture'), route = url.pathname.replace('/wp-json/tripanza-headless/v1/', '');
  const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(data)); };
  if (route === 'settings/public') return send({ host_enabled: true, public_cache_enabled: false, maintenance_enabled: false, announcement_enabled: false });
  if (route.startsWith('admin/')) {
    const token = req.headers.authorization?.replace('Bearer ', ''); if (!token) return send({ message: 'Please sign in.' }, 401); if (token !== 'fixture-admin') return send({ message: 'Admin only.' }, 403);
    if (route === 'admin/identity') return send({ name: 'Fixture Admin', api_version: '2.0.0' });
    if (/^admin\/bookings\/\d+\/editor$/.test(route)) return send(editor(Number(route.split('/')[2])));
    if (route !== 'admin/bookings/create') return send({ message: 'Not found.' }, 404);
    if (missing) return send({ message: 'Update native plugin.' }, 404);
    assert.ok(url.searchParams.has('_tripanza_live')); assert.equal(req.headers['cache-control'], 'no-cache, no-store');
    if (req.method === 'GET') return send(missingSource ? { ...initial, custom_prerequisites: { ...initial.custom_prerequisites, template_exists: false } } : initial);
    let raw = ''; for await (const chunk of req) raw += chunk; const body = JSON.parse(raw); attempts.push(body);
    assert.equal(body.nonce, 'fixture-create'); assert.match(body.request_id, /^[a-z0-9-]{36}$/);
    await new Promise(resolve => setTimeout(resolve, 150));
    if (failed) { failed = false; return send({ message: 'Fixture sold-out date.' }, 422); }
    if (!receipts.has(body.request_id)) receipts.set(body.request_id, { ok: true, order_id: 1000 + ++generated, message: body.mode === 'custom' ? 'Custom package booking successfully generated!' : 'Standard booking successfully generated!' });
    if (lost) { lost = false; return send({ message: 'Fixture lost response.', uncertain: true }, 503); }
    return send(receipts.get(body.request_id), 201);
  }
  if (route === 'account') return send({ id: 1, roles: ['administrator'], bookings: [], name: 'Fixture Admin', wallet: {} });
  if (route === 'tours' || route === 'meta-reels') return send({ items: [], total: 0 });
  return send({ message: 'Not found.' }, 404);
});
await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
const port = 3043, origin = `http://127.0.0.1:${port}`;
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { env: { ...process.env, WORDPRESS_URL: `http://127.0.0.1:${mock.address().port}`, NEXT_PUBLIC_SITE_URL: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser, logs = ''; app.stdout.on('data', data => logs += data); app.stderr.on('data', data => logs += data);
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/api/settings/public')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); if (i === 99) throw Error(logs); }
  const endpoint = origin + '/api/admin/bookings/create', headers = { Cookie: 'tripanza_session=fixture-admin', Origin: origin, 'Content-Type': 'application/json' };
  assert.equal((await fetch(endpoint)).status, 401); assert.equal((await fetch(endpoint, { headers: { Cookie: 'tripanza_session=fixture-user' } })).status, 403);
  assert.equal((await fetch(endpoint, { headers })).headers.get('cache-control'), 'private, no-store, max-age=0');
  const post = (payload, extra = {}) => fetch(endpoint, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(payload) });
  assert.equal((await post({ mode: 'custom' }, { Origin: 'https://evil.test', 'Sec-Fetch-Site': 'cross-site' })).status, 403); assert.equal((await post({ mode: 'delete' })).status, 400); assert.equal((await post({ mode: 'standard', extra: 'x'.repeat(65000) })).status, 413);
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await context.addCookies([{ name: 'tripanza_session', value: 'fixture-admin', domain: '127.0.0.1', path: '/' }]);
  const page = await context.newPage(), errors = [], navigations = []; page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url()); });
  await page.goto(origin + '/create-edit-bookings-for-admins'); await expect(page).toHaveURL(origin + '/admin/bookings/create'); const navCount = navigations.length;
  await expect(page.getByRole('heading', { name: 'Create & Manage Bookings' })).toBeVisible(); await expect(page.locator('iframe')).toHaveCount(0);
  await page.locator('#bm_tour_search').fill('spiti'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await expect(page.locator('#bm_selected_tour_id')).toHaveValue('11');
  await page.getByRole('button', { name: 'Custom Package', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Book Custom Package' })).toBeVisible(); await page.getByRole('button', { name: 'Standard Tour', exact: true }).click(); await expect(page.locator('#bm_tour_search')).toHaveValue('Spiti Private Admin Tour'); assert.equal(navigations.length, navCount, 'Tabs update without navigation');
  const fillContact = async () => { await page.locator('[name=first_name]').fill('Fixture'); await page.locator('[name=last_name]').fill('Guest'); await page.locator('[name=email]').fill('guest@example.test'); await page.locator('[name=phone]').fill('+91 98765 43210'); };
  await fillContact(); await page.locator('#tour_date_picker').fill('2026-11-10'); await page.locator('[name=adults]').fill('2'); await page.locator('[name="guest_name[0]"]').fill('First Guest | 25'); await page.locator('#addStandardGuestBtn').click(); await page.locator('[name="guest_name[1]"]').fill('Second Guest | 24'); await page.locator('[name="guest_title[1]"]').selectOption('miss');
  failed = true; await page.locator('#bm_submit_standard_btn').click(); await expect(page.locator('.bm-native-notice[role=alert]')).toContainText('Fixture sold-out date'); await expect(page.locator('[name=first_name]')).toHaveValue('Fixture');
  await page.locator('#bm_submit_standard_btn').click(); await expect(page.locator('#bm_created_booking_actions')).toBeVisible(); await expect(page.locator('#bm_success_overlay')).not.toHaveClass('active'); assert.equal(generated, 1); assert.equal(attempts.at(-1).fields.guests[1].title, 'miss');
  await page.locator('#bm_edit_created_booking').click(); await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('heading', { name: 'Edit booking #1001', exact: true, level: 1 })).toBeVisible({ timeout: 20000 }); await expect(page.locator('iframe')).toHaveCount(0); await expect(page).toHaveURL(origin + '/admin/bookings/create'); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('#bm_create_new_booking').click(); await expect(page.locator('[name=first_name]')).toHaveValue(''); await page.getByRole('button', { name: 'Custom Package', exact: true }).click(); await fillContact();
  await page.locator('[name=custom_package_name]').fill('Spiti Expedition'); await page.locator('[name=check_in]').fill('2026-11-10'); await page.locator('[name=check_out]').fill('2026-11-13'); await page.locator('[name=duration]').fill('3 Days / 2 Nights'); await page.locator('[name=boarding]').fill('Delhi'); await page.locator('[name=dropoff]').fill('Manali');
  await page.locator('#quad_price').fill('1000'); await page.locator('#pax_quad').fill('2'); await page.locator('#triple_price').fill('1200'); await page.locator('#pax_triple').fill('1'); await expect(page.locator('#calculated_grand_total')).toHaveValue('3200.00'); await page.locator('[name=advance_payment]').fill('0'); await page.locator('[name=balance_due_days]').fill('7');
  await page.locator('#addCreateCustomGuestBtn').click(); await page.getByRole('button', { name: 'Remove traveller 2' }).click(); await expect(page.locator('#createCustomGuestListContainer .guest-row')).toHaveCount(1);
  const out = path.join(os.tmpdir(), 'tripanza-booking-create-verification'); fs.mkdirSync(out, { recursive: true }); await page.screenshot({ path: path.join(out, 'create-custom-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Mobile no overflow'); await page.screenshot({ path: path.join(out, 'create-custom-mobile.png'), fullPage: true });
  lost = true; await page.locator('#bm_submit_custom_btn').click(); await expect(page.locator('.bm-native-notice[role=alert]')).toContainText('Fixture lost response'); await expect(page.locator('[name=quad_price]')).toBeDisabled(); await expect(page.getByRole('button', { name: 'Standard Tour', exact: true })).toBeDisabled(); const requestId = attempts.at(-1).request_id;
  await page.getByRole('button', { name: 'Retry same request', exact: true }).click(); await expect(page.locator('#bm_created_booking_actions')).toBeVisible(); assert.equal(attempts.at(-1).request_id, requestId); assert.equal(generated, 2); assert.equal(attempts.at(-1).fields.advance_payment, '0'); assert.equal(navigations.length, navCount, 'Creation/success/retry/modal never reload'); assert.deepEqual(errors, []);
  const guest = await browser.newContext(), gp = await guest.newPage(); await gp.goto(origin + '/admin/bookings/create'); await expect(gp).toHaveURL(origin + '/'); await guest.addCookies([{ name: 'tripanza_session', value: 'fixture-user', domain: '127.0.0.1', path: '/' }]); await gp.goto(origin + '/admin/bookings/create'); await expect(gp).toHaveURL(origin + '/'); await guest.close();
  missingSource = true; await page.reload(); await page.getByRole('button', { name: 'Custom Package', exact: true }).click(); await expect(page.locator('.bm-native-notice[role=status]')).toContainText('A new private tour and booking will still be created'); await expect(page.locator('#bm_submit_custom_btn')).toBeEnabled();
  missing = true; await page.reload(); await expect(page.getByRole('heading', { name: 'Booking manager is unavailable.' })).toBeVisible();
  console.log('PASS PHP 7.4, scoped original CSS parity, native tabs/search keyboard/drafts, all standard/custom fields, pricing/zero advance, traveller controls, failed validation, lost-response same-ID retry, success animation/editor modal/no reload, mobile, protected APIs and admin-only pages. QA: ' + out);
} finally { await browser?.close(); app.kill(); await new Promise(resolve => mock.close(resolve)); }
