const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');

test('CRM human-only mode and weekly AI schedule preserve human messaging and stop in-flight replies', { timeout: 45000 }, async t => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tripanza-crm-replies-'));
    const password = crypto.randomBytes(18).toString('base64url');
    const sent = [], requests = [];
    let release, started;
    const provider = http.createServer(async (req, res) => {
        let body = ''; for await (const chunk of req) body += chunk;
        const input = JSON.parse(body); requests.push(input);
        if (input.messages.at(-1).content === 'Slow enquiry') {
            started(); await new Promise(resolve => { release = resolve; });
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ id: 'fixture', object: 'chat.completion', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'How can I help with your trip?' } }] }));
    });
    await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
    Object.assign(process.env, {
        BUSINESS_DATA_DIR: dataDir, BUSINESS_ADMIN_EMAIL: 'admin@example.test', BUSINESS_ADMIN_PASSWORD: password,
        APP_SECRET: crypto.randomBytes(40).toString('hex'), REFRESH_SECRET: crypto.randomBytes(40).toString('hex'),
        BUSINESS_WORKSPACE_ENABLED: 'true', BUSINESS_AI_MODE: 'workspace', NODE_ENV: 'test', RATE_LIMIT_ENABLED: 'false',
        WEBSITE_KNOWLEDGE_ENABLED: 'false', TIMEZONE: 'Asia/Calcutta',
        AI_API_KEY: 'isolated-fixture-only', AI_MODEL: 'fixture', AI_BASE_URL: `http://127.0.0.1:${provider.address().port}/v1`,
    });
    let workspace;
    const server = http.createServer((req, res) => workspace.handleRequest(req, res));
    t.after(async () => {
        release?.();
        if (workspace) await workspace.close();
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
        provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve));
    });
    const { initializeWorkspace } = require('../business/runtime');
    workspace = await initializeWorkspace(server, {
        async status() { return { status: 'connected', qr: null }; },
        async send(jid, content) { const result = { key: { id: crypto.randomUUID(), remoteJid: jid, fromMe: true } }; sent.push({ jid, content }); return result; },
        async download() { return null; }, async connect() {}, async disconnect() {},
    }, { apiOnly: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const controls = await import('../business/backend/dist/services/crmReplyControls.js');
    const chats = await import('../business/backend/dist/services/conversation.js');
    const guard = await import('../business/backend/dist/services/conversationControls.js');
    const { config } = await import('../business/backend/dist/config.js');
    const { runMigrations } = await import('../business/backend/dist/db/migrate.js');
    async function api(url, method = 'GET', body, token) {
        return fetch(origin + url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    }
    const login = await api('/api/auth/login', 'POST', { email: 'admin@example.test', password });
    assert.equal(login.status, 200);
    const token = (await login.json()).accessToken;
    const endpoint = '/api/admin/crm-replies';
    const defaults = (await (await api(endpoint, 'GET', undefined, token)).json()).settings;
    assert.equal(defaults.enabled, true); assert.equal(defaults.scheduleEnabled, false);
    assert.equal((await api(endpoint)).status, 401);
    assert.equal((await api('/api/admin/users', 'POST', { name: 'Agent', email: 'agent@example.test', password, role: 'cs' }, token)).status, 201);
    const agent = (await (await api('/api/auth/login', 'POST', { email: 'agent@example.test', password })).json()).accessToken;
    assert.equal((await api(endpoint, 'PUT', defaults, agent)).status, 403);
    assert.equal((await api(endpoint, 'PUT', { ...defaults, timezone: 'Invalid/Zone' }, token)).status, 400);
    for (const patch of [{ days: [] }, { days: [7] }, { start: '24:00' }, { start: '18:00', end: '18:00' }, { enabled: 'false' }, { surprise: true }]) {
        assert.equal((await api(endpoint, 'PUT', { ...defaults, ...patch }, token)).status, 400);
    }
    const hours = { ...defaults, scheduleEnabled: true, days: [1], start: '09:00', end: '18:00' };
    const allowed = time => controls.crmReplyDecision(hours, new Date(time)).allowed;
    assert.equal(allowed('2026-10-12T03:29:00Z'), false);
    assert.equal(allowed('2026-10-12T03:30:00Z'), true); // Monday 09:00 India
    assert.equal(allowed('2026-10-12T12:29:00Z'), true);
    assert.equal(allowed('2026-10-12T12:30:00Z'), false); // end exclusive
    assert.equal(allowed('2026-10-13T03:30:00Z'), false);
    const overnight = { ...hours, days: [6], start: '22:00', end: '02:00' };
    assert.equal(controls.crmReplyDecision(overnight, new Date('2026-10-10T18:30:00Z')).allowed, true); // Sunday 00:00 from Saturday
    assert.equal(controls.crmReplyDecision(overnight, new Date('2026-10-10T20:30:00Z')).allowed, false);
    const dst = { ...hours, timezone: 'America/New_York', days: [0], start: '01:00', end: '02:00' };
    for (const time of ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z']) assert.equal(controls.crmReplyDecision(dst, new Date(time)).allowed, true);
    assert.equal(controls.crmReplyDecision({ ...hours, enabled: false }, new Date('2026-10-12T03:30:00Z')).allowed, false);
    let phone = 919900000001;
    async function inbound(text, number = String(phone++)) {
        await workspace.handleIncoming({ key: { remoteJid: `${number}@s.whatsapp.net`, id: crypto.randomUUID(), fromMe: false }, pushName: 'Customer', message: { conversation: text } });
        const customer = await chats.getCustomerByWaNumber(number);
        return chats.findActiveConversation(customer.id);
    }
    const initial = await inbound('Hello');
    assert.equal(sent.length, 1); assert.equal(requests.length, 1);
    async function save(settings) {
        const response = await api(endpoint, 'PUT', settings, token); assert.equal(response.status, 200); return response.json();
    }
    await save({ ...defaults, enabled: false });
    const savedChat = await chats.getConversation(initial.id);
    assert.equal(await guard.canGenerateReply(initial.id, initial.ai_revision), false);
    assert(savedChat.ai_revision > initial.ai_revision);
    const before = sent.length, providerBefore = requests.length;
    const humanOnly = await inbound('Please send tour details');
    assert.equal(humanOnly.status, 'waiting');
    await inbound('talk to bot', humanOnly.wa_number);
    config.aiMode = 'wordpress';
    const legacy = await inbound('A WordPress enquiry');
    assert.equal(legacy.status, 'waiting', 'WordPress mode must not fall through to legacy AI');
    config.aiMode = 'workspace';
    assert.equal(sent.length, before); assert.equal(requests.length, providerBefore);
    assert.equal((await api(`/api/conversations/${humanOnly.id}/claim`, 'POST', {}, agent)).status, 200);
    assert.equal(sent.length, before, 'Claim acknowledgement is suppressed in human-only mode');
    const manual = await api(`/api/conversations/${humanOnly.id}/messages`, 'POST', { content: 'A real person is here to help.' }, agent);
    assert.equal(manual.status, 201);
    assert.equal(sent.at(-1).content.text, 'A real person is here to help.');
    const today = new Intl.DateTimeFormat('en-US', { timeZone: defaults.timezone, weekday: 'short' }).format(new Date());
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(today);
    await save({ ...hours, days: [(day + 3) % 7] });
    const closedBefore = sent.length;
    assert.equal((await inbound('Outside scheduled hours')).status, 'waiting');
    assert.equal(sent.length, closedBefore);
    await runMigrations();
    assert.equal((await controls.getCrmReplyState()).allowed, false, 'Stored schedule survives repeated migrations');
    await save(defaults);
    const owned = await chats.getConversation(humanOnly.id);
    assert.equal(owned.status, 'active'); assert(owned.claimed_by, 'Enabling AI must preserve human ownership');
    await inbound('Hello again'); assert.equal(sent.length, closedBefore + 1);
    const providerStarted = new Promise(resolve => { started = resolve; });
    const pending = inbound('Slow enquiry');
    await providerStarted;
    const inFlightBefore = sent.length;
    await save({ ...defaults, enabled: false });
    await save(defaults); // Even a quick off/on must invalidate the old reply.
    release(); await pending;
    assert.equal(sent.length, inFlightBefore, 'Already-running reply is canceled by a settings change');
    assert.equal((await workspace.getCrmReplyState()).allowed, true);
});
