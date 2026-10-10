const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');

test('both QR pages require a live administrator login and never expose pairing data to visitors, agents or integration keys', { timeout: 45000 }, async t => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tripanza-qr-access-'));
    const password = crypto.randomBytes(18).toString('base64url');
    Object.assign(process.env, { BUSINESS_DATA_DIR: dataDir, BUSINESS_ADMIN_EMAIL: 'owner@example.test', BUSINESS_ADMIN_PASSWORD: password,
        APP_SECRET: crypto.randomBytes(40).toString('hex'), REFRESH_SECRET: crypto.randomBytes(40).toString('hex'),
        BUSINESS_WORKSPACE_ENABLED: 'true', WEBSITE_KNOWLEDGE_ENABLED: 'false', AI_API_KEY: '', NODE_ENV: 'test', RATE_LIMIT_ENABLED: 'false' });
    const qr = id => `data:image/png;base64,${Buffer.from(`private-pairing-${id}`).toString('base64')}`;
    let reads = 0, workspace;
    const server = http.createServer((req, res) => workspace.handleRequest(req, res));
    t.after(async () => { await workspace?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const { initializeWorkspace } = require('../business/runtime');
    workspace = await initializeWorkspace(server, {
        async status() { return { status: 'disconnected', qr: qr('crm') }; },
        async accountStatus(id) { reads++; return { status: 'connecting', qr: qr(id) }; },
        async send() { assert.fail('Pairing access must never send a message'); },
        async download() { return null; }, async connect() {}, async disconnect() {},
    }, { apiOnly: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function api(route, { method = 'GET', body, token, cookie, key } = {}) {
        return fetch(origin + route, { method, redirect: 'manual', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(key ? { 'X-API-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    }
    async function login(email) {
        const response = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        assert.equal(response.status, 200);
        return { ...(await response.json()), cookie: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
    }
    const paths = ['/', '/?preview=1', '/qr-crm', '/qr-crm/?refresh=1', '/qr-notifications', '/qr-notifications/?refresh=1'];
    const initialReads = reads;
    for (const route of paths) {
        const response = await api(route);
        assert.equal(response.status, 303); assert.match(response.headers.get('location'), /^\/login\?return_to=/);
        assert.match(response.headers.get('cache-control'), /private.*no-store/);
        const text = await response.text(); assert(!text.includes('data:image')); assert(!text.includes(qr('crm'))); assert(!text.includes(qr('notifications')));
    }
    assert.equal(reads, initialReads, 'No QR data should be read or encoded before authentication');
    for (const route of ['/api/gateway/qr', '/api/gateway/status', '/api/automation/accounts', '/api/automation/overview']) assert.equal((await api(route)).status, 401);
    assert.equal((await api('/qr-crm', { method: 'HEAD' })).status, 303);
    assert.equal((await api('/qr-crm', { cookie: 'access_token=invalid-session' })).status, 303);
    const jwt = require('../business/backend/node_modules/jsonwebtoken');
    const expired = jwt.sign({ sub: crypto.randomUUID(), role: 'super_admin', type: 'access', exp: Math.floor(Date.now() / 1000) - 10 }, process.env.APP_SECRET);
    assert.equal((await api('/qr-notifications', { token: expired })).status, 303);
    const owner = await login('owner@example.test');
    for (const [email, role] of [['agent@example.test', 'cs'], ['admin@example.test', 'admin']]) {
        assert.equal((await api('/api/admin/users', { method: 'POST', token: owner.accessToken, body: { name: email, email, password, role } })).status, 201);
    }
    const agent = await login('agent@example.test');
    const admin = await login('admin@example.test');
    const blockedReads = reads;
    for (const route of paths) assert.equal((await api(route, { cookie: agent.cookie })).status, 403);
    assert.equal(reads, blockedReads, 'Agents cannot retrieve pairing data');
    assert.equal((await api('/api/gateway/qr', { token: agent.accessToken })).status, 403);
    assert.equal((await api('/api/automation/accounts', { token: agent.accessToken })).status, 403);
    for (const session of [owner, admin]) {
        for (const id of ['crm', 'notifications']) {
            const response = await api(`/qr-${id}?refresh=1`, { cookie: session.cookie });
            assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private.*no-store/);
            assert.match(response.headers.get('vary'), /Cookie/); assert.match(response.headers.get('vary'), /Authorization/);
            const text = await response.text(); assert(text.includes(qr(id))); assert(!text.includes(qr(id === 'crm' ? 'notifications' : 'crm')));
        }
    }
    assert.equal((await api('/', { cookie: owner.cookie })).status, 200);
    const accounts = await (await api('/api/automation/accounts', { token: owner.accessToken })).json();
    assert.equal(accounts.find(item => item.id === 'notifications').qr, qr('notifications'));
    const { db, schema } = await import('../business/backend/dist/db/index.js');
    const { eq } = require('../business/backend/node_modules/drizzle-orm');
    const users = await (await api('/api/admin/users', { token: owner.accessToken })).json();
    const ownerId = users.find(user => user.email === 'owner@example.test').id;
    const adminId = users.find(user => user.email === 'admin@example.test').id;
    const automation = await import('../business/backend/dist/services/automation.js');
    const integrationKey = (await automation.createApiKey('Fixture integration', ownerId)).token;
    assert.equal((await api('/qr-crm', { key: integrationKey })).status, 303);
    for (const route of ['/api/automation/accounts', '/api/automation/overview']) {
        const response = await api(route, { key: integrationKey }); assert.equal(response.status, 200);
        const text = await response.text(); assert(!text.includes(qr('crm'))); assert(!text.includes(qr('notifications')));
    }
    // A signed-in agent receives only connection state over shared live updates.
    const { io } = require('../business/frontend/node_modules/socket.io-client');
    const socket = io(origin, { auth: { token: agent.accessToken }, transports: ['websocket'], reconnection: false });
    t.after(() => socket.disconnect());
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('No shared gateway state received')), 8000);
        socket.once('gateway:status', value => { clearTimeout(timer); try { assert.deepEqual(Object.keys(value), ['status']); resolve(); } catch (error) { reject(error); } });
        socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
    });
    await db.update(schema.users).set({ role: 'cs' }).where(eq(schema.users.id, adminId));
    assert.equal((await api('/qr-crm', { cookie: admin.cookie })).status, 403, 'A former admin cannot use a stale role in the JWT');
    await db.update(schema.users).set({ role: 'admin', is_active: false }).where(eq(schema.users.id, adminId));
    assert.equal((await api('/qr-notifications', { cookie: admin.cookie })).status, 303, 'Inactive administrators cannot view codes');
    assert.equal((await api('/api/auth/logout', { method: 'POST', cookie: owner.cookie })).status, 200);
    for (const route of ['/qr-crm', '/qr-notifications']) assert.equal((await api(route, { cookie: owner.cookie })).status, 303, 'Logged-out sessions cannot retrieve a code');
});

test('raw HTTP routes cannot expose QR codes when the workspace is disabled or unavailable', async () => {
    const vm = require('node:vm');
    const source = fs.readFileSync(path.join(__dirname, '../bot.js'), 'utf8');
    const { isWorkspaceRequest } = require('../business/runtime');
    const { safeRequestHandler, configureHttpServer } = require('../business/httpServer');
    let handler;
    vm.runInNewContext(source.slice(source.indexOf('const server = http.createServer'), source.indexOf('workspaceReady = initializeWorkspace')), {
        http: { createServer(callback) { handler = callback; return {}; } }, safeRequestHandler, configureHttpServer, isWorkspaceRequest,
        businessWorkspace: null, workspaceUnavailable(res) { res.writeHead(503); res.end('Workspace unavailable'); }, Buffer, console: { error() {} },
    });
    for (const url of ['/', '/qr-crm', '/qr-notifications', '/qr-crm/?refresh=1']) {
        let status, text;
        await handler({ method: 'GET', url }, { writeHead(code) { status = code; }, end(value) { text = value; } });
        assert.equal(status, 503); assert.equal(text, 'Workspace unavailable');
    }
});
