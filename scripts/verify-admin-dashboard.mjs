// Production Next.js + mocked WordPress JSON API. No production writes/mail/AI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import postcss from 'postcss';
import { adminDashboardFixture } from './admin-dashboard-fixture.mjs';
const require = createRequire(import.meta.url), ts = require('typescript');
const optional = createRequire(path.join(os.tmpdir(), 'tripanza-studio-validation/node_modules/fixture.cjs'));
const PHPParser = optional('php-parser'), { chromium, expect } = optional('@playwright/test');
const read = file => fs.readFileSync(file, 'utf8');
for (const file of ['tripanza-headless-admin.php', ...fs.readdirSync('wordpress/tripanza-headless-admin/includes').map(file => 'includes/' + file)]) new PHPParser.Engine({ parser: { version: '7.4', suppressErrors: false } }).parseCode(read('wordpress/tripanza-headless-admin/' + file), file);
const plugin = read('wordpress/tripanza-headless-admin/tripanza-headless-admin.php');
for (const check of ["current_user_can('manage_options')", "wp_verify_nonce($nonce, 'tripanza_native_admin')", "Only the task author may delete", "private, no-store", "request_key", "write_lock"]) assert.ok(plugin.includes(check), check);
for (const file of ['src/app/admin/page.tsx', 'src/components/admin/AdminDashboard.tsx', 'src/lib/admin-dashboard.ts', 'src/app/api/admin/dashboard/route.ts']) assert.ok(!/iframe|HostOriginalStudio|tripanza_admin_studio|adminDashboardHTML/.test(read(file)), file + ' must be native');
assert.ok(!fs.existsSync('public/admin-dashboard-bridge.js'));
assert.ok(!fs.existsSync('wordpress/tripanza-headless-admin/templates/dashboard.php'));
const original = read('../Tripanza-custom-admin-dashboard.php');
const declarations = css => { const result = []; postcss.parse(css).walkDecls(declaration => result.push([declaration.prop, declaration.value])); return result; };
assert.deepEqual(declarations(read('src/components/admin/admin-dashboard-original.css')), declarations(original.match(/<style>([\s\S]*?)<\/style>/)[1]), 'Original styling must be preserved');
assert.equal(read('src/components/admin/admin-menu-original.css').replace(/\r\n/g, '\n').trim(), read('../Tripanza-admin-menu.php').match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\r\n/g, '\n').trim());
const ai = read('wordpress/tripanza-headless-admin/includes/holidays.php');
assert.equal(ai.slice(ai.indexOf('$prompt = "'), ai.indexOf('$response = wp_remote_post')).trim(), original.slice(original.indexOf('$prompt = "'), original.indexOf('$response = wp_remote_post')).trim());
assert.ok(!/wp_send_json|echo |<html/.test(read('wordpress/tripanza-headless-admin/includes/itinerary.php')));
const output = ts.transpileModule(read('src/lib/admin-dashboard-types.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {} }; vm.runInNewContext(output, context);
let workspace = adminDashboardFixture();
const metrics = context.exports.dashboardAnalytics(workspace.bookings, 2026, '2026', 'all');
assert.equal(metrics.count, 2); assert.equal(metrics.revenue, 20000); assert.equal(metrics.persons, 5);
assert.equal(context.exports.dashboardAnalytics(workspace.bookings, 2026, '2026', '9').revenue, 12000);
assert.equal(metrics.previous[9], 5000);
console.log('PASS: PHP 7.4 syntax, JSON-only API, original CSS/menu/prompt parity, archive/status analytics contract');

const actions = [], requests = [];
let failToggle = false, failAdd = false, emailCalls = 0, aiCalls = 0, missingPlugin = false;
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture'), route = url.pathname.replace('/wp-json/tripanza-headless/v1/', '');
  const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(data)); };
  requests.push({ route, method: req.method });
  if (route === 'settings/public') return send({ host_enabled: true, public_cache_enabled: false, maintenance_enabled: false, announcement_enabled: false });
  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (route.startsWith('admin/')) {
    if (!auth) return send({ message: 'Please sign in.' }, 401);
    if (auth !== 'fixture-admin') return send({ message: 'Administrator access required.' }, 403);
    if (missingPlugin && route !== 'admin/settings') return send({ message: 'Plugin missing.' }, 404);
    if (route === 'admin/settings') return send({ settings: {}, controls_version: '1.1.0' });
    if (route === 'admin/identity') return send({ id: 1, name: 'Fixture Admin', api_version: '2.0.0' });
    if (route !== 'admin/workspace') return send({ message: 'Not found.' }, 404);
    assert.ok(url.searchParams.has('_tripanza_live'));
    assert.equal(req.headers['cache-control'], 'no-cache, no-store');
    if (req.method === 'GET') return send(workspace);
    let raw = ''; for await (const chunk of req) raw += chunk;
    const data = JSON.parse(raw); actions.push(data);
    if (data.nonce !== 'fixture-nonce') return send({ message: 'Dashboard session expired.' }, 403);
    await new Promise(resolve => setTimeout(resolve, 250));
    if (data.action === 'add_todo') {
      if (failAdd) { failAdd = false; return send({ message: 'Fixture save failed.' }, 500); }
      workspace.tasks.unshift({ id: String(Date.now()), text: data.todo_text, target_date: data.todo_date, status: 'pending', author: 'Fixture Admin', author_id: 1 });
      return send({ tasks: workspace.tasks });
    }
    if (data.action === 'toggle_todo') {
      if (failToggle) { failToggle = false; return send({ message: 'Fixture toggle failed.' }, 409); }
      workspace.tasks = workspace.tasks.map(task => task.id === data.todo_id ? { ...task, status: data.status } : task);
      return send({ tasks: workspace.tasks });
    }
    if (data.action === 'delete_todo') { workspace.tasks = workspace.tasks.filter(task => task.id !== data.todo_id); return send({ tasks: workspace.tasks }); }
    if (data.action === 'add_future_trip') {
      data.trip_dates.split(',').forEach((date, index) => workspace.plans.push({ id: `${Date.now()}-${index}`, month: 'october', name: data.trip_name, dates: date, author: 'Fixture Admin', author_id: 1 }));
      return send({ plans: workspace.plans });
    }
    if (data.action === 'delete_future_trip') { workspace.plans = workspace.plans.filter(plan => plan.id !== data.trip_id); return send({ plans: workspace.plans }); }
    if (data.action === 'generate_preset_holidays') { aiCalls++; workspace.holidays.push({ date: 'Oct 4 - Oct 5', name: `Generated ${data.preset_type}`, desc: 'Fixture AI planning idea', category: data.preset_type === 'long_weekends' ? 'general' : data.preset_type }); return send({ holidays: workspace.holidays }); }
    if (data.action === 'clear_all_holidays') { workspace.holidays = []; return send({ holidays: [] }); }
    if (data.action === 'send_tour_itinerary_email') { emailCalls++; return send({ message: 'Itinerary emailed successfully and saved to CRM!' }); }
    return send({ message: 'Action not allowed.' }, 400);
  }
  if (route === 'account') return send({ id: 1, roles: ['administrator'], name: 'Fixture Admin', email: 'admin@example.test', bookings: [], wallet: { balance: 0 } });
  if (route === 'tours') return send({ items: [], total: 0 });
  if (route === 'meta-reels') return send({ items: [] });
  return send({ message: 'Not found.' }, 404);
});
await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.ADMIN_TEST_PORT || 3039), origin = `http://127.0.0.1:${port}`;
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { env: { ...process.env, WORDPRESS_URL: `http://127.0.0.1:${mock.address().port}`, NEXT_PUBLIC_SITE_URL: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser;
app.stdout.on('data', data => logs += data); app.stderr.on('data', data => logs += data);
try {
  for (let attempt = 0; attempt < 80; attempt++) { try { if ((await fetch(origin + '/api/settings/public')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 250)); if (attempt === 79) throw new Error(logs); }
  const headers = { Cookie: 'tripanza_session=fixture-admin', Origin: origin, 'Content-Type': 'application/json' };
  assert.equal((await fetch(origin + '/api/admin/dashboard')).status, 401);
  assert.equal((await fetch(origin + '/api/admin/dashboard', { headers: { Cookie: 'tripanza_session=fixture-user' } })).status, 403);
  const post = (data, overrides = {}) => fetch(origin + '/api/admin/dashboard', { method: 'POST', headers: { ...headers, ...overrides }, body: JSON.stringify(data) });
  assert.equal((await post({ action: 'add_todo' }, { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await post({ action: 'not_allowed' })).status, 400);
  assert.equal((await post({ action: 'add_todo', nonce: 'invalid' })).status, 403);
  assert.equal((await post({ action: 'add_todo', todo_text: 'x'.repeat(17000) })).status, 413);
  const response = await fetch(origin + '/api/admin/dashboard', { headers });
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  const html = await (await fetch(origin + '/admin', { headers })).text();
  assert.ok(html.includes('Welcome to Tripanza Dashboard')); assert.ok(!html.includes('<iframe')); assert.ok(!html.includes('fixture-admin'));
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await browserContext.addCookies([{ name: 'tripanza_session', value: 'fixture-admin', url: origin }]);
  const page = await browserContext.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Offline CDN scripts must not block native functionality.
  await page.route('https://cdnjs.cloudflare.com/**', route => route.abort());
  await page.goto(origin + '/admin');
  await page.getByRole('heading', { name: 'Welcome to Tripanza Dashboard' }).waitFor();
  assert.equal(await page.locator('iframe').count(), 0); assert.equal(await page.locator('.tp-bottom-menu').count(), 0);
  let navigations = 0; page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++; });
  await expect(page.locator('#tzValConfirmed')).toHaveText('2'); await expect(page.locator('#tzValRevenue')).toHaveText('₹20,000.00');
  await page.getByLabel('Analytics month').selectOption('9'); await expect(page.locator('#tzValRevenue')).toHaveText('₹12,000.00');
  await page.getByLabel('Analytics year').selectOption('2025'); await expect(page.locator('#tzValRevenue')).toHaveText('₹5,000.00');
  await page.getByRole('button', { name: 'Show year 2026 revenue', exact: true }).click(); await expect(page.locator('.native-revenue-chart circle')).toHaveCount(12);
  await page.getByRole('button', { name: 'Show year 2026 revenue', exact: true }).click(); await expect(page.locator('.native-revenue-chart circle')).toHaveCount(24);
  assert.equal(aiCalls, 0); assert.equal(emailCalls, 0);
  await page.getByLabel('Trip destination').fill('Native two-date plan');
  await page.getByLabel('Trip departure dates').click();
  await page.getByLabel('Departure calendar year').fill('2027'); await expect(page.getByRole('button', { name: '2027-10-04', exact: true })).toBeVisible();
  await page.getByLabel('Departure calendar month').selectOption('10'); await expect(page.getByRole('button', { name: '2027-11-04', exact: true })).toBeVisible();
  await page.getByLabel('Departure calendar year').fill('2026'); await page.getByLabel('Departure calendar month').selectOption('9');
  await page.getByRole('button', { name: '2026-10-04', exact: true }).click(); await page.getByRole('button', { name: '2026-10-09', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Add Plan', exact: true }).click();
  await expect(page.locator('#future-trip-list h4').filter({ hasText: 'Native two-date plan' })).toHaveCount(2);
  assert.equal(actions.at(-1).trip_dates, '2026-10-04,2026-10-09');
  await page.locator('#trip-filters').getByRole('button', { name: 'September' }).click(); await expect(page.locator('#future-trip-list .empty-state')).toBeVisible();
  await page.locator('#trip-filters').getByRole('button', { name: 'All Months' }).click();
  await page.getByLabel('Task description').fill('New native task'); await page.getByLabel('Task target date').fill('2026-10-03');
  failAdd = true; await page.locator('#ajax-todo-form').getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.native-admin-notice[role="alert"]')).toContainText('Fixture save failed'); await expect(page.getByLabel('Task description')).toHaveValue('New native task');
  const requestKey = actions.at(-1).request_key;
  await page.locator('#ajax-todo-form').getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('#todo-list .todo-content p').filter({ hasText: 'New native task' })).toHaveCount(1); assert.equal(actions.at(-1).request_key, requestKey);
  const task = page.locator('#todo-list .todo-item').filter({ hasText: 'New native task' });
  failToggle = true; await task.getByRole('button', { name: 'Mark as done: New native task', exact: true }).click();
  await expect(task).toHaveClass(/todo-completed/); await expect(page.locator('.native-admin-notice[role="alert"]')).toContainText('Fixture toggle failed'); await expect(task).not.toHaveClass(/todo-completed/);
  await task.getByRole('button', { name: 'Mark as done: New native task', exact: true }).click(); await expect(task).toHaveClass(/todo-completed/);
  await expect(task.getByRole('button', { name: 'Mark pending: New native task', exact: true })).toBeEnabled();
  await page.locator('#todo-filters').getByRole('button', { name: 'Completed' }).click(); await expect(page.locator('#todo-list .todo-item')).toHaveCount(1);
  await page.locator('#todo-filters').getByRole('button', { name: 'Overdue' }).click(); await expect(page.locator('#todo-list')).toContainText('Other admin task');
  assert.equal(await page.getByRole('button', { name: 'Delete task Other admin task' }).count(), 0);
  await page.locator('#todo-filters').getByRole('button', { name: 'All', exact: true }).click();
  page.on('dialog', dialog => dialog.accept());
  await expect(task.getByRole('button', { name: 'Delete task New native task' })).toBeEnabled(); await task.getByRole('button', { name: 'Delete task New native task' }).click(); await expect(task).toHaveCount(0);
  for (const preset of ['Long Weekends', 'Festive Weekends', 'DU Trips', 'IPU Trips', 'Amity Trips', 'Mumbai & Pune Trips', 'Gujarat Trips', 'Bangalore & South Trips', 'Corporate 9-5 Getaways']) {
    const button = page.locator('#ai-preset-pills').getByRole('button', { name: preset, exact: true }); await expect(button).toBeEnabled(); await button.click(); await expect(button).toHaveText(preset); await expect(button).toBeEnabled();
  }
  assert.equal(aiCalls, 9);
  await page.locator('#holiday-filters').getByRole('button', { name: 'DU Trips' }).click(); await expect(page.locator('#holiday-list')).toContainText('Generated du');
  await page.getByRole('button', { name: 'Delete All', exact: true }).click(); await expect(page.locator('#holiday-list .empty-state')).toBeVisible();
  await page.getByLabel('Search admin tours').fill('mountain'); await page.getByRole('button', { name: 'Fixture mountain escape', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download PDF Itinerary' })).toBeEnabled();
  await page.getByLabel('Customer email').fill('customer@example.test'); await page.getByLabel('Customer phone').fill('+919876543210'); await page.getByLabel('Customer departure date').fill('2026-10-04');
  await page.getByRole('button', { name: 'Send Email', exact: true }).click(); await expect(page.locator('.tp-email-box')).toContainText('Itinerary emailed successfully');
  assert.equal(emailCalls, 1); assert.equal(actions.at(-1).post_id, 42);
  assert.equal(navigations, 0, 'Actions and filters must never reload the document');
  await page.getByRole('button', { name: 'Open admin menu' }).click(); await expect(page.locator('#adminMenu')).toHaveClass(/is-active/);
  for (const label of ['AI Inbox', 'Booking History', 'Create Booking', 'Add / Edit Trips', 'Tripwise Costing', 'Poster Download', 'List of Hosts', 'Host Commission', 'Sale Campaigns', 'Inflow/Outflow/Profits', 'Activity Logs', 'Site Settings']) await expect(page.locator('#adminMenu').getByRole('link', { name: label, exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#adminMenu')).not.toHaveClass(/is-active/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Trip departure dates').click(); await expect(page.locator('.native-date-calendar')).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile must not overflow');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: path.join(os.tmpdir(), 'tripanza-native-admin-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 }); await page.screenshot({ path: path.join(os.tmpdir(), 'tripanza-native-admin-desktop.png'), fullPage: true });
  await page.reload(); await expect(page.locator('#future-trip-list h4').filter({ hasText: 'Native two-date plan' })).toHaveCount(2);
  missingPlugin = true; await page.reload(); await page.getByRole('heading', { name: 'Dashboard is unavailable.' }).waitFor();
  await expect(page.getByText('Install or update Tripanza Native Admin API', { exact: false })).toBeVisible();
  assert.deepEqual(errors, []);
  console.log('PASS: native SSR, JSON permissions/cache/origin, local analytics/search/calendar, all nine presets, AJAX task/plan/email, optimistic rollback, retry keys, persistence, menu, mobile, missing plugin');
} finally { await browser?.close(); app.kill(); await new Promise(resolve => mock.close(resolve)); }
