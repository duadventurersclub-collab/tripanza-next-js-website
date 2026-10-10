const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');

test('team workspace: AI, inbox ownership, media, ratings, access, and live updates', { timeout: 30000 }, async t => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tripanza-workspace-test-'));
    const password = crypto.randomBytes(18).toString('base64url');
    const aiRequests = [];
    const providerAuth = [];
    let connectionStatus = 200;
    let notifyProviderStarted, releaseProvider;
    let notifySummaryStarted, releaseSummary;
    const provider = http.createServer(async (req, res) => {
        let body = ''; for await (const chunk of req) body += chunk;
        const input = JSON.parse(body); aiRequests.push(input); providerAuth.push(req.headers.authorization);
        if (input.messages.at(-1).content === 'Check AI connection.') {
            res.setHeader('Content-Type', 'application/json');
            if (connectionStatus !== 200) { res.writeHead(connectionStatus); res.end(JSON.stringify({ error: { message: `Sensitive provider echo: ${req.headers.authorization}` } })); return; }
            res.end(JSON.stringify({ id: 'connection-test', object: 'chat.completion', choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'check', type: 'function', function: { name: 'connection_check', arguments: '{}' } }] } }] })); return;
        }
        if (input.messages.at(-1).content === 'Please wait while an agent claims this') {
            notifyProviderStarted();
            await new Promise(resolve => { releaseProvider = resolve; });
        }
        const summary = input.messages[0].content.startsWith('Summarize');
        if (summary && notifySummaryStarted) { notifySummaryStarted(); await new Promise(resolve => { releaseSummary = resolve; }); }
        const tool = input.messages.at(-1).content === 'Please escalate via tool';
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ id: 'mock', object: 'chat.completion', choices: [{ index: 0, finish_reason: tool ? 'tool_calls' : 'stop', message: tool ? { role: 'assistant', content: null, tool_calls: [{ id: 'handoff', type: 'function', function: { name: 'transfer_to_cs', arguments: '{}' } }] } : { role: 'assistant', content: summary ? 'Customer asked about a trip and the team helped.' : 'Tell me your travel dates and group size.' } }] }));
    });
    await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
    Object.assign(process.env, {
        WEBSITE_KNOWLEDGE_ENABLED: "false",
        BUSINESS_DATA_DIR: dataDir, BUSINESS_ADMIN_EMAIL: 'admin@example.test', BUSINESS_ADMIN_PASSWORD: password,
        APP_SECRET: crypto.randomBytes(40).toString('hex'), REFRESH_SECRET: crypto.randomBytes(40).toString('hex'),
        BUSINESS_WORKSPACE_ENABLED: 'true', BUSINESS_AI_MODE: 'workspace', NODE_ENV: 'test', RATE_LIMIT_ENABLED: 'false',
        AI_API_KEY: 'local-test-provider-only', AI_MODEL: 'mock-model', AI_BASE_URL: `http://127.0.0.1:${provider.address().port}/v1`,
    });
    const sent = [];
    let sendFails = false;
    let disconnectFails = false;
    let workspace;
    const server = http.createServer((req, res) => {
        if (workspace) return workspace.handleRequest(req, res);
        res.writeHead(503); res.end();
    });
    t.after(async () => {
        if (workspace) await workspace.close();
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
        provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve));
    });
    const adapter = {
        async status() { return { status: 'connected', qr: null }; },
        async send(jid, content, options) {
            if (sendFails) throw new Error('Mock offline gateway');
            const result = { key: { id: crypto.randomUUID(), remoteJid: jid, fromMe: true }, message: { conversation: content.text || content.caption || '' } };
            sent.push({ jid, content, options, result }); return result;
        },
        async download() { return Buffer.from('test attachment'); },
        async connect() {}, async disconnect() { if (disconnectFails) throw new Error('Mock gateway disconnect failed'); },
    };
    const { initializeWorkspace } = require('../business/runtime');
    workspace = await initializeWorkspace(server, adapter, { apiOnly: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const { db, schema } = await import('../business/backend/dist/db/index.js');
    const { getConversations, getMessages, getCustomerByWaNumber } = await import('../business/backend/dist/services/conversation.js');
    const { setStockData } = await import('../business/backend/dist/services/stock.js');
    const { businessHoursContext } = await import('../business/backend/dist/services/chatbot.js');
    const { io } = require('../business/frontend/node_modules/socket.io-client');
    async function api(url, { method = 'GET', body, token, cookie, headers = {} } = {}) {
        return fetch(origin + url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    }
    async function login(email) {
        const res = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        assert.equal(res.status, 200); return { ...(await res.json()), cookie: res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ') };
    }
    const admin = await login('admin@example.test');
    const adminToken = admin.accessToken;
    await t.test('gateway disconnect failure returns 503 while the HTTP service remains healthy', async () => {
        disconnectFails = true;
        try {
            const failed = await api('/api/gateway/disconnect', { method: 'POST', token: adminToken });
            assert.equal(failed.status, 503); assert.match((await failed.json()).error, /Could not disconnect/);
            assert.equal((await api('/api/health')).status, 200);
        } finally { disconnectFails = false; }
    });
    const inbound = (number, text, id = crypto.randomUUID(), extra = {}) => ({ key: { remoteJid: `${number}@s.whatsapp.net`, id, fromMe: false, ...extra }, pushName: 'Test Traveller', message: { conversation: text } });
    await t.test('authentication and roles protect admin, inbox, uploads, and mutation origins', async () => {
        assert.equal((await api('/api/admin/users')).status, 401);
        assert.equal((await api('/api/conversations')).status, 401);
        assert.equal((await api('/uploads/missing.jpg')).status, 401);
        assert.equal((await api('/api/admin/bot-config', { token: adminToken, method: 'PUT', body: { persona_name: 'Kanika' }, headers: { Origin: 'https://unrelated.example' } })).status, 403);
        for (const email of ['agent1@example.test', 'agent2@example.test']) {
            const created = await api('/api/admin/users', { method: 'POST', token: adminToken, body: { name: email, email, password, role: 'cs' } });
            assert.equal(created.status, 201);
        }
    });
    const agent1 = await login('agent1@example.test');
    const agent2 = await login('agent2@example.test');
    const list = await (await api('/api/admin/users', { token: adminToken })).json();
    const agentId = email => list.find(u => u.email === email).id;
    const available = await (await api('/api/conversations/agents', { token: agent2.accessToken })).json();
    assert(available.some(a => a.id === agentId('agent1@example.test')));
    assert(available.every(a => !('email' in a) && !('password_hash' in a)));
    assert.equal((await api('/api/admin/users', { token: agent1.accessToken })).status, 403);
    let conversation;
    await t.test('private-trip settings persist drafts, validate financial rules, and stay inactive', async () => {
        const endpoint = '/api/admin/private-trips';
        assert.equal((await api(endpoint)).status, 401);
        assert.equal((await api(endpoint, { token: agent1.accessToken })).status, 403);
        const initial = await (await api(endpoint, { token: adminToken })).json();
        assert.equal(initial.quotingEnabled, false);
        assert.equal(initial.settings.markup.value, null);
        assert.deepEqual(initial.settings.sheets, []);
        const draft = {
            sheets: [
                { name: 'Hotels', url: 'https://docs.google.com/spreadsheets/d/test_workbook/edit?usp=sharing#gid=99', tab: 'Hotels', category: 'hotels' },
                { name: 'Vehicles', url: 'https://docs.google.com/spreadsheets/d/test_workbook/edit', tab: 'Transport', category: 'transport' },
            ],
            vendors: [{ name: 'Approved supplier', url: 'https://supplier.example.com/', notes: 'Private cars and hotels' }],
            sourcePolicy: 'sheets_and_vendors', markup: { type: 'percentage', value: 12.5 },
        };
        const saved = await api(endpoint, { method: 'PUT', token: adminToken, body: draft });
        assert.equal(saved.status, 200);
        const status = await saved.json();
        assert.equal(status.quotingEnabled, false);
        assert.equal(status.status, 'setup_pending');
        assert.equal(status.settings.sheets[0].url, 'https://docs.google.com/spreadsheets/d/test_workbook/edit');
        assert.equal(status.settings.markup.value, 12.5);
        assert.deepEqual((await (await api(endpoint, { token: adminToken })).json()).settings, status.settings);
        const [stored] = await db.select().from(schema.privateTripSettings);
        assert.deepEqual(JSON.parse(stored.config_json), status.settings);
        const { runMigrations } = await import('../business/backend/dist/db/migrate.js');
        await runMigrations();
        assert.deepEqual((await (await api(endpoint, { token: adminToken })).json()).settings, status.settings, 'repeat migration preserves settings');
        const invalid = [
            { ...draft, markup: { type: 'percentage', value: -1 } },
            { ...draft, markup: { type: 'percentage', value: 101 } },
            { ...draft, markup: { type: 'fixed', value: 1.234 } },
            { ...draft, markup: { type: 'percentage', value: '12' } },
            { ...draft, sourcePolicy: 'whole_internet' },
            { ...draft, sheets: [{ ...draft.sheets[0], url: 'https://evil.example.com/spreadsheets/d/id/edit' }] },
            { ...draft, sheets: [draft.sheets[0], draft.sheets[0]] },
            { ...draft, vendors: [{ ...draft.vendors[0], url: 'javascript:alert(1)' }] },
            { ...draft, vendors: [{ ...draft.vendors[0], url: 'https://key:secret@supplier.example.com/' }] },
            { ...draft, vendors: [{ ...draft.vendors[0], url: 'https://127.0.0.1/' }] },
            { ...draft, quotingEnabled: true },
        ];
        for (const body of invalid) assert.equal((await api(endpoint, { method: 'PUT', token: adminToken, body })).status, 400);
        assert.deepEqual((await (await api(endpoint, { token: adminToken })).json()).settings, status.settings, 'invalid edits preserve saved settings');
        const created = await api('/api/admin/users', { method: 'POST', token: adminToken, body: { name: 'Settings reviewer', email: 'reviewer@example.test', password, role: 'admin' } });
        assert.equal(created.status, 201);
        const reviewer = await login('reviewer@example.test');
        assert.equal((await api(endpoint, { token: reviewer.accessToken })).status, 200);
        assert.equal((await api(endpoint, { method: 'PUT', token: reviewer.accessToken, body: draft })).status, 403);
        assert.equal((await api(endpoint, { method: 'PUT', token: adminToken, body: draft, headers: { Origin: 'https://unrelated.example' } })).status, 403);
        for (const markup of [{ type: 'fixed', value: 500 }, { type: 'percentage', value: 0 }, { type: 'percentage', value: null }]) {
            const result = await api(endpoint, { method: 'PUT', token: adminToken, body: { sheets: [], vendors: [], sourcePolicy: 'sheets_only', markup } });
            assert.equal(result.status, 200);
            const data = await result.json(); assert.deepEqual(data.settings.markup, markup); assert.equal(data.quotingEnabled, false);
        }
        assert.equal(sent.length, 0, 'saving configuration never sends messages');
        assert.equal(aiRequests.length, 0, 'saving configuration never calls AI or quotes suppliers');
    });
    await t.test('configurable AI uses current persona, inventory, business hours, and a single current message', async () => {
        assert.match(businessHoursContext('Monday-Friday 09:00-17:00', new Date('2026-10-05T05:00:00Z')), /open/);
        assert.match(businessHoursContext('', new Date()), /not been configured/);
        const configRes = await api('/api/admin/bot-config', { method: 'PUT', token: adminToken, body: { persona_name: 'Kanika Tripanza', business_info: 'Monday-Friday 09:00-17:00. Mountain trips.' } });
        assert.equal(configRes.status, 200);
        setStockData([{ name: 'Mountain trip', stock: 4, price: 1500 }]);
        const msg = inbound('919000000001', 'Do you have a mountain trip?');
        assert.equal(await workspace.handleIncoming(msg), true);
        assert.equal(sent.length, 1);
        assert.match(aiRequests[0].messages[0].content, /Kanika Tripanza/);
        assert.match(aiRequests[0].messages[0].content, /Mountain trip/);
        assert.equal(aiRequests[0].messages.filter(m => m.content === msg.message.conversation).length, 1);
        await workspace.handleIncoming(msg);
        assert.equal(sent.length, 1, 'duplicate inbound delivery does not reply twice');
        conversation = (await getConversations({})).conversations[0];
        assert.equal((await getMessages({ conversationId: conversation.id })).messages.length, 2);
    });
    await t.test('tool-call and keyword handoffs enter the queue without duplicate replies', async () => {
        await workspace.handleIncoming(inbound('919000000001', '#chatcs'));
        conversation = (await getConversations({ status: 'waiting' })).conversations[0];
        assert.equal(conversation.wa_number, '919000000001');
        await workspace.handleIncoming(inbound('919000000002', 'Please escalate via tool'));
        assert.equal((await getConversations({ status: 'waiting' })).conversations.length, 2);
    });
    await t.test('first claim is exclusive and transfers preserve assigned ownership', async () => {
        const claims = await Promise.all([agent1, agent2].map(a => api(`/api/conversations/${conversation.id}/claim`, { method: 'POST', token: a.accessToken, body: {} })));
        assert.equal(claims.filter(r => r.status === 200).length, 1);
        const beforeEcho = (await getMessages({ conversationId: conversation.id })).messages.length;
        await workspace.handleIncoming(sent.at(-1).result);
        assert.equal((await getMessages({ conversationId: conversation.id })).messages.length, beforeEcho, 'automatic claim reply echoes must not duplicate history');
        const transferred = await api(`/api/conversations/${conversation.id}/transfer`, { method: 'POST', token: adminToken, body: { toCsId: agentId('agent2@example.test') } });
        assert.equal(transferred.status, 200);
        assert.equal((await transferred.json()).claimed_by, agentId('agent2@example.test'));
        assert.equal((await api(`/api/conversations/${conversation.id}/resolve`, { method: 'POST', token: agent1.accessToken, body: {} })).status, 403);
        const before = sent.length;
        await workspace.handleIncoming(inbound('919000000001', 'An agent is helping me.'));
        assert.equal(sent.length, before, 'AI does not answer an agent-owned chat');
    });
    await t.test('agent sends report delivery failures, handle media, and reject path traversal', async () => {
        const endpoint = `/api/conversations/${conversation.id}/messages`;
        const before = (await getMessages({ conversationId: conversation.id })).messages.length;
        sendFails = true;
        assert.equal((await api(endpoint, { method: 'POST', token: agent2.accessToken, body: { content: 'Should fail', contentType: 'text' } })).status, 503);
        assert.equal((await getMessages({ conversationId: conversation.id })).messages.length, before);
        sendFails = false;
        const sentText = await api(endpoint, { method: 'POST', token: agent2.accessToken, body: { content: 'Here is your itinerary.', contentType: 'text' } });
        assert.equal(sentText.status, 201);
        const message = await sentText.json();
        assert(message.wa_message_id);
        const beforeEcho = (await getMessages({ conversationId: conversation.id })).messages.length;
        await workspace.handleIncoming({ ...sent.at(-1).result, pushName: 'Agent' });
        assert.equal((await getMessages({ conversationId: conversation.id })).messages.length, beforeEcho);
        assert.equal((await api(endpoint, { method: 'POST', token: agent2.accessToken, body: { contentType: 'document', mediaUrl: '/uploads/../../credentials.json' } })).status, 400);
        const media = await api(endpoint, { method: 'POST', token: agent2.accessToken, body: { contentType: 'image', fileData: 'data:image/png;base64,' + Buffer.from('test-image').toString('base64'), fileName: 'trip.png', content: 'A trip photo', quotedMessageId: message.id } });
        assert.equal(media.status, 201);
        const attachment = await media.json();
        assert(attachment.media_url.startsWith('/uploads/'));
        assert.equal((await api(attachment.media_url, { token: agent2.accessToken })).status, 200);
        assert(sent.at(-1).options.quoted);
        const page = await api(`/api/conversations/${conversation.id}/messages?limit=2`, { token: agent2.accessToken });
        const batch = await page.json(); assert.equal(batch.messages.length, 2); assert(batch.nextCursor);
    });
    await t.test('hold pauses automation and resume retains assigned ownership', async () => {
        assert.equal((await api(`/api/conversations/${conversation.id}/hold`, { method: 'POST', token: agent1.accessToken, body: {} })).status, 403);
        assert.equal((await api(`/api/conversations/${conversation.id}/hold`, { method: 'POST', token: agent2.accessToken, body: {} })).status, 200);
        const before = sent.length;
        await workspace.handleIncoming(inbound('919000000001', 'I am waiting for the team.'));
        assert.equal(sent.length, before);
        assert.equal((await api(`/api/conversations/${conversation.id}/unhold`, { method: 'POST', token: agent2.accessToken, body: {} })).status, 200);
        assert.equal((await (await api(`/api/conversations/${conversation.id}`, { token: adminToken })).json()).claimed_by, agentId('agent2@example.test'));
    });
    await t.test('resolution, rating, notes, and returning-customer sessions persist', async () => {
        const resolved = await api(`/api/conversations/${conversation.id}/resolve`, { method: 'POST', token: agent2.accessToken, body: { review: 'Customer needs a mountain itinerary.' } });
        assert.equal(resolved.status, 200);
        await workspace.handleIncoming(inbound('919000000001', '5'));
        const history = await (await api(`/api/conversations/${conversation.id}`, { token: adminToken })).json();
        assert.equal(history.rating, 5); assert.equal(history.status, 'resolved');
        await workspace.handleIncoming(inbound('919000000001', 'Can we plan another trip?'));
        const customer = await getCustomerByWaNumber('919000000001');
        assert.equal(customer.total_sessions, 2);
        assert.equal((await (await api('/api/admin/cs-stats', { token: adminToken })).json()).find(u => u.id === agentId('agent2@example.test')).total_resolved, 1);
        assert((await (await api('/api/admin/audit-log', { token: adminToken })).json()).length > 0);
    });
    await t.test('real-time socket updates authenticate; logout revokes API access and disconnects', async () => {
        const socket = io(origin, { auth: { token: agent1.accessToken }, transports: ['websocket'], reconnection: false });
        await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
        const update = new Promise(resolve => socket.once('conversation:message', resolve));
        await workspace.handleIncoming(inbound('919000000003', '#chatcs'));
        assert((await update).conversationId);
        const logout = await api('/api/auth/logout', { method: 'POST', token: agent1.accessToken, cookie: agent1.cookie, body: {} });
        assert.equal(logout.status, 200);
        assert.equal((await api('/api/auth/me', { token: agent1.accessToken })).status, 401);
        socket.disconnect();
        const anonymous = io(origin, { transports: ['websocket'], reconnection: false });
        await new Promise(resolve => anonymous.once('connect_error', resolve));
        anonymous.disconnect();
    });
    await t.test('notification preferences, reports, and gateway status work through shared API', async () => {
        const pref = await api('/api/notifications/preferences', { method: 'PUT', token: agent2.accessToken, body: { notif_type: 'new_chat', is_enabled: false } });
        assert.equal(pref.status, 200);
        assert.equal((await api('/api/gateway/status', { token: adminToken })).status, 200);
        const stats = await (await api('/api/admin/dashboard-stats', { token: adminToken })).json();
        assert(stats.totalCustomers >= 3); assert(stats.todayMessages > 0);
        assert.equal((await api('/api/admin/stock/preview', { token: adminToken })).status, 200);
    });
    await t.test('editing masked stock settings preserves saved credentials', async () => {
        const stock = { source_type: 'mysql', is_active: false, config_json: { host: 'localhost', password: 'test-stock-only', credentials_path: '/private/service-account.json' } };
        assert.equal((await api('/api/admin/stock-config', { method: 'PUT', token: adminToken, body: stock })).status, 200);
        const saved = await (await api('/api/admin/stock-config', { token: adminToken })).json();
        const edited = JSON.parse(saved.config_json);
        assert.equal(edited.password, '***'); assert.equal(edited.credentials_path, stock.config_json.credentials_path);
        edited.host = 'database.example.test';
        assert.equal((await api('/api/admin/stock-config', { method: 'PUT', token: adminToken, body: { config_json: edited } })).status, 200);
        const raw = (await db.select().from(schema.stockConfig))[0];
        assert.equal(JSON.parse(raw.config_json).password, stock.config_json.password);
    });
    await t.test('pagination keeps messages and conversations with identical timestamps', async () => {
        await db.update(schema.messages).set({ created_at: '2026-10-04T12:00:00.000Z' });
        await db.update(schema.conversations).set({ created_at: '2026-10-04T12:00:00.000Z' });
        const all = (await getMessages({ conversationId: conversation.id, limit: 100 })).messages;
        let cursor, ids = [];
        do { const page = await getMessages({ conversationId: conversation.id, limit: 2, cursor }); ids.push(...page.messages.map(m => m.id)); cursor = page.nextCursor; } while (cursor);
        assert.equal(ids.length, all.length); assert.equal(new Set(ids).size, all.length);
        const conversations = (await getConversations({ limit: 100 })).conversations;
        cursor = undefined; ids = [];
        do { const page = await getConversations({ limit: 1, cursor }); ids.push(...page.conversations.map(c => c.id)); cursor = page.nextCursor; } while (cursor);
        assert.equal(ids.length, conversations.length); assert.equal(new Set(ids).size, conversations.length);
    });
    await t.test('WordPress fallback preserves legacy replies while retaining the inbox', async () => {
        const { config } = await import('../business/backend/dist/config.js');
        config.aiMode = 'wordpress';
        const before = sent.length;
        const handled = await workspace.handleIncoming(inbound('919000000004', 'Tell me about a beach trip.'));
        assert.equal(handled, false); assert.equal(sent.length, before);
        assert((await getCustomerByWaNumber('919000000004')).id);
        config.aiMode = 'workspace';
    });
    await t.test('claiming during AI generation stops the automated reply', async () => {
        const providerStarted = new Promise(resolve => { notifyProviderStarted = resolve; });
        const processing = workspace.handleIncoming(inbound('919000000005', 'Please wait while an agent claims this'));
        await providerStarted;
        const chat = (await getConversations({ limit: 100 })).conversations.find(c => c.wa_number === '919000000005');
        assert.equal((await api(`/api/conversations/${chat.id}/claim`, { method: 'POST', token: agent2.accessToken, body: {} })).status, 200);
        const afterClaim = sent.length;
        releaseProvider(); await processing;
        assert.equal(sent.length, afterClaim, 'The pending AI reply must be discarded');
        assert.equal((await (await api(`/api/conversations/${chat.id}`, { token: adminToken })).json()).status, 'active');
    });
    await t.test('settings API keys are encrypted, private, applied immediately, and replaceable without restart', async () => {
        const { getAiClient } = await import('../business/backend/dist/services/aiSettings.js');
        const { config } = await import('../business/backend/dist/config.js');
        const { websiteStatus } = await import('../business/backend/dist/services/website.js');
        const endpoint = '/api/admin/ai-provider';
        const configured = await (await api(endpoint, { token: adminToken })).json();
        assert.equal(configured.source, 'environment'); assert(!JSON.stringify(configured).includes(config.ai.apiKey));
        assert.equal((await api(endpoint)).status, 401);
        assert.equal((await api(endpoint, { token: agent2.accessToken })).status, 403);
        const ownerOnly = await api('/api/admin/users', { method: 'POST', token: adminToken, body: { name: 'Admin', email: 'admin2@example.test', password, role: 'admin' } }); assert.equal(ownerOnly.status, 201);
        const ordinaryAdmin = await login('admin2@example.test');
        assert.equal((await api(endpoint, { token: ordinaryAdmin.accessToken })).status, 200);
        const key = crypto.randomBytes(28).toString('base64url');
        assert.equal((await api(endpoint, { method: 'PUT', token: ordinaryAdmin.accessToken, body: { apiKey: key } })).status, 403);
        assert.equal((await api(endpoint + '/test', { method: 'POST', token: ordinaryAdmin.accessToken })).status, 403);
        assert.equal((await api(endpoint, { method: 'DELETE', token: ordinaryAdmin.accessToken })).status, 403);
        for (const body of [{ apiKey: '' }, { apiKey: 'bad key with spaces' }, { apiKey: ['bad'] }, { apiKey: key, baseUrl: 'https://outside.example' }]) assert.equal((await api(endpoint, { method: 'PUT', token: adminToken, body })).status, 400);
        const saved = await api(endpoint, { method: 'PUT', token: adminToken, body: { apiKey: key } }); assert.equal(saved.status, 200);
        const payload = await saved.json(); assert.equal(payload.configured, true); assert.equal(payload.source, 'workspace'); assert(!JSON.stringify(payload).includes(key));
        const stored = (await db.select().from(schema.aiCredentials))[0]; assert(stored.encrypted_key.startsWith('v1.')); assert(!stored.encrypted_key.includes(key));
        assert.equal((await api(endpoint + '/test', { method: 'POST', token: adminToken })).status, 200);
        assert.equal(providerAuth.at(-1), `Bearer ${key}`);
        await workspace.handleIncoming(inbound('919000000006', 'Use the settings API key for this reply.'));
        assert.equal(providerAuth.at(-1), `Bearer ${key}`); assert.match(sent.at(-1).content.text, /travel dates/);
        const reopened = require('node:child_process').spawnSync(process.execPath, ['-e', `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);process.stdout.write(db.prepare('SELECT encrypted_key FROM ai_credentials').get().encrypted_key);db.close();`, path.join(dataDir, 'workspace.db')], { encoding: 'utf8' });
        assert.equal(reopened.status, 0); assert.equal(reopened.stdout, stored.encrypted_key);
        const nextKey = crypto.randomBytes(28).toString('base64url');
        await api(endpoint, { method: 'PUT', token: adminToken, body: { apiKey: nextKey } });
        await api(endpoint + '/test', { method: 'POST', token: adminToken }); assert.equal(providerAuth.at(-1), `Bearer ${nextKey}`);
        const audits = await db.select().from(schema.auditLog); assert(audits.some(a => a.action === 'update_ai_api_key')); assert(!JSON.stringify(audits).includes(key)); assert(!JSON.stringify(audits).includes(nextKey));
        const metadata = await (await api(endpoint, { token: adminToken })).json(); assert(!JSON.stringify(metadata).includes(nextKey));
        connectionStatus = 401;
        const rejected = await api(endpoint + '/test', { method: 'POST', token: adminToken }); assert.equal(rejected.status, 422);
        const error = await rejected.json(); assert.match(error.error, /rejected/); assert(!JSON.stringify(error).includes(nextKey)); connectionStatus = 200;
        config.ai.apiKey = ''; assert.equal((await websiteStatus()).aiConfigured, true, 'website status recognizes the settings key without an environment key');
        const removed = await api(endpoint, { method: 'DELETE', token: adminToken }); assert.equal(removed.status, 200); assert.equal((await removed.json()).configured, false);
        assert.equal(await getAiClient(), null);
        config.ai.apiKey = 'local-test-provider-only';
        assert.equal((await (await api(endpoint, { token: adminToken })).json()).source, 'environment');
        await api(endpoint + '/test', { method: 'POST', token: adminToken }); assert.equal(providerAuth.at(-1), 'Bearer local-test-provider-only');
    });
    await t.test('AI pause persists, saves incoming messages without replies, and resume hands ownership back to the assistant', async () => {
        const owner = await login('agent1@example.test');
        const number = '919000000801';
        await workspace.handleIncoming(inbound(number, 'Can you help with a trip?'));
        let chat = (await getConversations({})).conversations.find(c => c.wa_number === number);
        const endpoint = `/api/conversations/${chat.id}/ai`;
        assert.equal((await api(endpoint, { method: 'PUT', body: { paused: true } })).status, 401);
        assert.equal((await api(endpoint, { method: 'PUT', token: adminToken, body: { paused: 'true' } })).status, 400);
        assert.equal((await api(endpoint, { method: 'PUT', token: adminToken, body: { paused: true, status: 'active' } })).status, 400);
        assert.equal((await api(endpoint, { method: 'PUT', token: adminToken, body: { paused: true }, headers: { Origin: 'https://unrelated.example' } })).status, 403);
        const pause = await api(endpoint, { method: 'PUT', token: adminToken, body: { paused: true } }); assert.equal(pause.status, 200);
        assert.equal((await pause.json()).ai_paused, true);
        const before = sent.length, requestsBefore = aiRequests.length;
        await workspace.handleIncoming(inbound(number, 'Incoming while paused'));
        assert.equal(sent.length, before); assert.equal(aiRequests.length, requestsBefore);
        assert((await getMessages({ conversationId: chat.id })).messages.some(m => m.content === 'Incoming while paused'));
        const { spawnSync } = require('node:child_process');
        const persisted = spawnSync(process.execPath, ['-e', `const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1]);process.stdout.write(JSON.stringify(d.prepare('SELECT ai_paused FROM conversations WHERE id=?').get(process.argv[2])));d.close();`, path.join(dataDir, 'workspace.db'), chat.id], { encoding: 'utf8' });
        assert.equal(persisted.status, 0); assert.equal(JSON.parse(persisted.stdout).ai_paused, 1);
        const { runMigrations } = await import('../business/backend/dist/db/migrate.js'); await runMigrations();
        assert.equal((await (await api(`/api/conversations/${chat.id}`, { token: adminToken })).json()).ai_paused, true);
        assert.equal((await api(`/api/conversations/${chat.id}/claim`, { method: 'POST', token: owner.accessToken, body: {} })).status, 200);
        assert.equal((await api(endpoint, { method: 'PUT', token: agent2.accessToken, body: { paused: false } })).status, 403);
        const res = await api(endpoint, { method: 'PUT', token: owner.accessToken, body: { paused: false } }); assert.equal(res.status, 200);
        const resumed = await res.json(); assert.equal(resumed.status, 'bot'); assert.equal(resumed.claimed_by, null); assert.equal(resumed.ai_paused, false);
        const afterResume = sent.length;
        await workspace.handleIncoming(inbound(number, 'New message after resume')); assert.equal(sent.length, afterResume + 1);
        assert.equal((await api(`/api/conversations/${chat.id}/resolve`, { method: 'POST', token: adminToken, body: {} })).status, 200);
        assert.equal((await api(endpoint, { method: 'PUT', token: adminToken, body: { paused: false } })).status, 409);
        assert.equal((await api(`/api/conversations/${chat.id}`, { method: 'DELETE', token: adminToken })).status, 200);
    });
    await t.test('pause/resume cancels the AI response already in progress', async () => {
        const number = '919000000802';
        const started = new Promise(resolve => { notifyProviderStarted = resolve; });
        const before = sent.length;
        const pending = workspace.handleIncoming(inbound(number, 'Please wait while an agent claims this')); await started;
        const chat = (await getConversations({})).conversations.find(c => c.wa_number === number);
        for (const paused of [true, false]) assert.equal((await api(`/api/conversations/${chat.id}/ai`, { method: 'PUT', token: adminToken, body: { paused } })).status, 200);
        releaseProvider(); releaseProvider = null; await pending;
        assert.equal(sent.length, before, 'a stale answer does not send after a quick pause/resume');
        await workspace.handleIncoming(inbound(number, 'A fresh message')); assert.equal(sent.length, before + 1);
        await api(`/api/conversations/${chat.id}`, { method: 'DELETE', token: adminToken });
    });
    await t.test('administrator deletion cascades history, clears memory, cleans private files and broadcasts removal', async () => {
        const number = '919000000803';
        await workspace.handleIncoming(inbound(number, 'Please help plan my trip'));
        const chat = (await getConversations({})).conversations.find(c => c.wa_number === number);
        const customer = await getCustomerByWaNumber(number);
        const { rememberPreferences, rememberTour } = await import('../business/backend/dist/services/memory.js');
        await rememberPreferences(customer.id, { dates: '16 October' }, 'Travel on 16 October');
        const { addMessage } = await import('../business/backend/dist/services/conversation.js');
        const privateFile = path.join(dataDir, 'uploads', 'delete-fixture.pdf'); fs.mkdirSync(path.dirname(privateFile), { recursive: true }); fs.writeFileSync(privateFile, 'private fixture');
        await addMessage({ conversationId: chat.id, sender: 'bot', content: 'Private document', contentType: 'document', mediaUrl: '/uploads/delete-fixture.pdf' });
        assert.equal((await api(`/api/conversations/${chat.id}`, { method: 'DELETE' })).status, 401);
        assert.equal((await api(`/api/conversations/${chat.id}`, { method: 'DELETE', token: agent2.accessToken })).status, 403);
        const socket = io(origin, { auth: { token: adminToken }, transports: ['websocket'], reconnection: false });
        await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
        const event = new Promise(resolve => socket.once('conversation:deleted', resolve));
        assert.equal((await api(`/api/conversations/${chat.id}`, { method: 'DELETE', token: adminToken })).status, 200);
        assert.equal((await event).conversationId, chat.id); socket.disconnect();
        assert.equal((await api(`/api/conversations/${chat.id}`, { token: adminToken })).status, 404);
        assert.equal((await getMessages({ conversationId: chat.id })).messages.length, 0);
        assert.equal(fs.existsSync(privateFile), false);
        const memory = (await db.select().from(schema.customerMemory)).find(m => m.customer_id === customer.id); assert.equal(memory.preferences_json, '{}'); assert.equal(memory.customer_notes, '[]'); assert.equal(memory.selected_tour, null); assert(memory.reset_at);
        await assert.rejects(rememberPreferences(customer.id, { dates: '16 October' }, '16 October', { id: chat.id, revision: 0 }), /no longer permits/);
        await rememberTour(customer.id, 'stale-tour', { id: chat.id, revision: 0 });
        assert.equal((await db.select().from(schema.customerMemory)).find(m => m.customer_id === customer.id).selected_tour, null);
        const retained = await getCustomerByWaNumber(number); assert(retained); assert.equal(retained.last_summary, null); assert.equal(retained.last_conversation_id, null);
        assert.equal((await api(`/api/conversations/${chat.id}`, { method: 'DELETE', token: adminToken })).status, 404);
        const before = sent.length; await workspace.handleIncoming(inbound(number, 'Start a new conversation'));
        const replacement = (await getConversations({})).conversations.find(c => c.wa_number === number); assert.notEqual(replacement.id, chat.id); assert.equal(sent.length, before + 1);
        await api(`/api/conversations/${replacement.id}`, { method: 'DELETE', token: adminToken });
    });
    await t.test('deleting during generation or summary cannot send a late reply or restore deleted context', async () => {
        const number = '919000000804';
        const started = new Promise(resolve => { notifyProviderStarted = resolve; });
        const before = sent.length;
        const pending = workspace.handleIncoming(inbound(number, 'Please wait while an agent claims this')); await started;
        const chat = (await getConversations({})).conversations.find(c => c.wa_number === number);
        assert.equal((await api(`/api/conversations/${chat.id}`, { method: 'DELETE', token: adminToken })).status, 200);
        releaseProvider(); releaseProvider = null; await pending; assert.equal(sent.length, before);
        await workspace.handleIncoming(inbound(number, 'A new chat for summary testing'));
        const current = (await getConversations({})).conversations.find(c => c.wa_number === number);
        const summaryStarted = new Promise(resolve => { notifySummaryStarted = resolve; });
        const { generateAndSaveSummary } = await import('../business/backend/dist/services/orchestrator.js');
        const summary = generateAndSaveSummary(current.id, current.customer_id); await summaryStarted;
        await api(`/api/conversations/${current.id}`, { method: 'DELETE', token: adminToken });
        releaseSummary(); releaseSummary = null; notifySummaryStarted = null; await summary;
        assert.equal((await getCustomerByWaNumber(number)).last_summary, null);
    });
});

test('dashboard and QR templates remain available through authenticated workspace routes', () => {
    const { renderDashboard, renderBotPage } = require('../frontend');
    const { isWorkspaceRequest } = require('../business/runtime');
    const html = renderDashboard(true, false);
    assert(html.includes('href="/qr-notifications"')); assert(html.includes('href="/qr-crm"')); assert(html.includes('href="/workspace"'));
    assert(!isWorkspaceRequest('/api/send')); assert(isWorkspaceRequest('/')); assert(isWorkspaceRequest('/qr-crm')); assert(isWorkspaceRequest('/qr-notifications/?refresh=1'));
    for (const crm of [true, false]) {
        assert(renderBotPage(crm, 'qr', 'data:image/png;base64,mock').includes('location.reload(), 30000'));
        assert(renderBotPage(crm, 'starting').includes('location.reload(), 5000'));
        assert(!renderBotPage(crm, 'connected').includes('setTimeout'));
    }
});

test('the existing outbound API still authenticates and sends through both original bots', async () => {
    const vm = require('node:vm');
    const source = fs.readFileSync(path.join(__dirname, '..', 'bot.js'), 'utf8');
    const requests = [];
    let handler;
    vm.runInNewContext(source.slice(source.indexOf('const server = http.createServer'), source.indexOf('workspaceReady = initializeWorkspace')), {
        http: { createServer(callback) { handler = callback; return {}; } }, API_KEY: 'isolated-test-key',
        ...require('../business/httpServer'), Buffer,
        safeKeyMatch: key => key === 'isolated-test-key', sockCRM: { name: 'crm' }, sockNotifications: { name: 'notifications' },
        isConnectedCRM: true, isConnectedNotifications: true,
        async sendTextWithLinkCta(socket, jid, message, crm) { requests.push({ socket, jid, message, crm }); }, console: { log() {}, error() {} },
    });
    for (const bot of ['crm', 'notifications']) {
        const req = new (require('node:events').EventEmitter)(); req.method = 'POST'; req.url = '/api/send';
        let status, body;
        await handler(req, { writeHead(code) { status = code; }, end(value) { body = JSON.parse(value); } });
        req.emit('data', JSON.stringify({ api_key: 'isolated-test-key', bot, phone: '09000000001', message: 'Existing API still works' }));
        await req.listeners('end')[0]();
        assert.equal(status, 200); assert(body.success); assert.equal(requests.at(-1).socket.name, bot); assert.equal(requests.at(-1).jid, '919000000001@s.whatsapp.net');
    }
});
