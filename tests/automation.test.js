const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

test('persistent messaging operations: scheduler, campaigns, rules, accounts, groups, webhooks and official buttons', async t => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tripanza-automation-test-'));
    const password = crypto.randomBytes(18).toString('base64url');
    Object.assign(process.env, { BUSINESS_DATA_DIR: dataDir, BUSINESS_ADMIN_EMAIL: 'operations@example.test', BUSINESS_ADMIN_PASSWORD: password,
        APP_SECRET: crypto.randomBytes(40).toString('hex'), REFRESH_SECRET: crypto.randomBytes(40).toString('hex'),
        BUSINESS_WORKSPACE_ENABLED: 'true', WEBSITE_KNOWLEDGE_ENABLED: 'false', AI_API_KEY: '', NODE_ENV: 'test', RATE_LIMIT_ENABLED: 'false' });
    const sent = [], accountActions = [], groupActions = [], requests = [], accountStates = new Map();
    let offline = false, sendFails = false, webhookFails = false, workspace;
    const server = http.createServer((req, res) => workspace.handleRequest(req, res));
    const adapter = {
        async status() { return { status: offline ? 'disconnected' : 'connected', qr: null }; },
        async send(jid, content) {
            if (sendFails) throw new Error('PRIVATE_PROVIDER_ERROR');
            const result = { key: { id: crypto.randomUUID(), remoteJid: jid, fromMe: true }, message: { conversation: content.text || content.caption || '' } };
            sent.push({ account: 'crm', jid, content, result }); return result;
        },
        async accountStatus(id) { return { status: id === 'crm' ? offline ? 'disconnected' : 'connected' : accountStates.get(id) || 'disconnected', qr: null }; },
        async accountAction(id, action) { accountActions.push({ id, action }); accountStates.set(id, action === 'connect' ? 'connected' : 'disconnected'); },
        async accountSend(account, jid, content) { const result = { key: { id: crypto.randomUUID(), remoteJid: jid, fromMe: true } }; sent.push({ account, jid, content, result }); return result; },
        async groupAction(account, action, data) {
            groupActions.push({ account, action, data });
            if (action === 'list') return [{ id: '123456789@g.us', subject: 'Manali travellers', size: 2 }];
            if (action === 'details' || action === 'create') return { id: '123456789@g.us', subject: data.subject || 'Manali travellers', participants: [{ id: '919000000001@s.whatsapp.net', admin: 'admin' }] };
            return { success: true };
        },
        async download() { return null; }, async connect() {}, async disconnect() {},
    };
    workspace = await require('../business/runtime').initializeWorkspace(server, adapter, { apiOnly: true });
    const automation = await import('../business/backend/dist/services/automation.js');
    const transport = await import('../business/backend/dist/services/automationTransport.js');
    const { db, schema } = await import('../business/backend/dist/db/index.js');
    const { eq } = require('../business/backend/node_modules/drizzle-orm');
    await automation.stopAutomation();
    await automation.initAutomation({}, { manual: true });
    const realNow = Date.now; let clock = realNow(); Date.now = () => clock;
    // timestamp() intentionally uses the real Date constructor; use due dates in
    // the past and advance only the pacing clock, without waiting 10–30 seconds.
    async function tick() { clock += 31000; await automation.runAutomationTick(); }
    const requestTransport = async (url, options) => {
        requests.push({ url, options });
        if (url.includes('graph.facebook.com')) return { status: 200, mime: 'application/json', body: Buffer.from(JSON.stringify(options.method === 'POST' ? { messages: [{ id: 'wamid.' + crypto.randomUUID() }] } : { verified_name: 'Mock Tripanza' })) };
        if (url.endsWith('.pdf')) return { status: 200, mime: 'application/pdf', body: Buffer.from('%PDF-1.7 mock itinerary') };
        return { status: webhookFails ? 503 : 200, mime: 'application/json', body: Buffer.from('{}') };
    };
    transport.setAutomationTestTransport(requestTransport);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => { Date.now = realNow; transport.setAutomationTestTransport(null); await workspace.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    async function api(url, body, { token, key, method = body === undefined ? 'GET' : 'POST' } = {}) {
        return fetch(origin + url, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'X-API-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    }
    const login = await api('/api/auth/login', { email: 'operations@example.test', password }); assert.equal(login.status, 200);
    const token = (await login.json()).accessToken;
    async function call(route, body, method) { const response = await api('/api/automation' + route, body, { token, method }); const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result; }
    const jobByCampaign = async campaignId => (await automation.listJobs(campaignId))[0];
    const past = '2020-01-01T00:00:00.000Z';
    async function campaign(payload = { text: '*Departure*\n• Your pickup details' }, recipient = '919000000001', gatewayId = 'crm') {
        return (await call('/campaigns', { name: 'Test reminder', gatewayId, recipients: [recipient], dueAt: past, payload })).campaignId;
    }

    await t.test('admin authentication, API key scope, revocation and private encrypted credentials', async () => {
        assert.equal((await api('/api/automation/overview')).status, 401);
        const created = await call('/api-keys', { name: 'n8n tests' });
        const keyResponse = await api('/api/automation/overview', undefined, { key: created.token }); assert.equal(keyResponse.status, 200);
        assert.equal((await api('/api/automation/accounts', { name: 'Blocked', type: 'qr' }, { key: created.token })).status, 403);
        const keys = await call('/api-keys'); assert(!JSON.stringify(keys).includes(created.token)); assert(!JSON.stringify(keys).includes('hash'));
        await call('/api-keys/' + created.id, undefined, 'DELETE');
        assert.equal((await api('/api/automation/overview', undefined, { key: created.token })).status, 401);
    });
    await t.test('drafts wait for Start, deduplicate recipients, retain formatting and send one job once', async () => {
        const count = sent.length;
        const result = await call('/campaigns', { name: 'Two recipients', recipients: ['919000000001', '919000000001', '919000000002'], dueAt: past, payload: { text: '*Trip*\n• Pickup' } });
        assert.equal(result.count, 2);
        await tick(); assert.equal(sent.length, count);
        await call(`/campaigns/${result.campaignId}/start`, {});
        await Promise.all([tick(), automation.runAutomationTick()]); assert.equal(sent.length, count + 1);
        assert.equal(sent.at(-1).content.text, '*Trip*\n• Pickup');
        await call(`/campaigns/${result.campaignId}/cancel`, {});
        await tick(); assert.equal(sent.length, count + 1);
        const jobs = await automation.listJobs(result.campaignId); assert(jobs.some(job => job.state === 'sent')); assert(jobs.some(job => job.state === 'canceled'));
    });
    await t.test('scheduled drafts, pause, offline waiting and process recovery never repeat accepted sends', async () => {
        const future = await call('/campaigns', { name: 'Future departure', dueAt: '2099-01-01T00:00:00Z', recipients: ['919000000003'], timezone: 'Asia/Calcutta', payload: { text: 'Future' } });
        await call(`/campaigns/${future.campaignId}/start`, {}); const count = sent.length; await tick(); assert.equal(sent.length, count);
        await call(`/campaigns/${future.campaignId}/pause`, {}); assert.equal((await jobByCampaign(future.campaignId)).state, 'draft');
        const pending = await campaign(); await call(`/campaigns/${pending}/start`, {}); offline = true; await tick(); assert.equal((await jobByCampaign(pending)).state, 'queued');
        assert.match((await jobByCampaign(pending)).error, /offline/); offline = false; await call(`/campaigns/${pending}/cancel`, {});
        const uncertain = await campaign(); const job = await jobByCampaign(uncertain);
        await db.update(schema.automationJobs).set({ state: 'sending' }).where(eq(schema.automationJobs.id, job.id));
        await automation.stopAutomation(); await automation.initAutomation({}, { manual: true });
        assert.equal((await jobByCampaign(uncertain)).state, 'unknown'); await tick(); assert.equal(sent.length, count);
    });
    await t.test('attachment bytes are validated; button fallbacks stay readable and experimental controls are opt-in', async () => {
        const key = await campaign({ text: 'Your itinerary', media: { kind: 'document', url: 'https://files.example.test/itinerary.pdf', fileName: 'itinerary.pdf' }, buttons: [{ kind: 'url', label: 'View trip', value: 'https://tripanza.com/tour/manali/' }] });
        await call(`/campaigns/${key}/start`, {}); await tick(); assert(Buffer.isBuffer(sent.at(-1).content.document)); assert.match(sent.at(-1).content.caption, /https:\/\/tripanza.com/);
        await call('/buttons', { mode: 'experimental' }, 'PUT'); const next = await campaign({ text: 'Choose', buttons: [{ kind: 'reply', label: 'Private trip', value: 'Private trip' }] });
        await call(`/campaigns/${next}/start`, {}); await tick(); assert.equal(sent.at(-1).content.__interactiveButtons[0].value, 'Private trip');
        await call('/buttons', { mode: 'links' }, 'PUT');
        const failed = await campaign(); await call(`/campaigns/${failed}/start`, {}); sendFails = true; await tick(); sendFails = false;
        const job = await jobByCampaign(failed); assert.equal(job.state, 'unknown'); assert(!job.error.includes('PRIVATE_PROVIDER_ERROR'));
    });
    let extra;
    await t.test('additional accounts are isolated, reconnect only after activation and route group actions correctly', async () => {
        extra = (await call('/accounts', { name: 'Trip operations', type: 'qr' })).id;
        assert.equal(accountActions.length, 0);
        await call(`/accounts/${extra}/connect`, {}); assert.equal(accountActions.at(-1).id, extra);
        const key = await campaign({ text: 'Operational message' }, '919000000004', extra); await call(`/campaigns/${key}/start`, {}); await tick(); assert.equal(sent.at(-1).account, extra);
        const groups = await call(`/groups/${extra}/list`, {}); assert.equal(groups[0].subject, 'Manali travellers');
        await call(`/groups/${extra}/participants`, { jid: '123456789@g.us', participants: ['919000000005'], operation: 'add' });
        assert.equal(groupActions.at(-1).account, extra); assert.deepEqual(groupActions.at(-1).data.participants, ['919000000005@s.whatsapp.net']);
        assert.equal((await api(`/api/automation/groups/${extra}/participants`, { jid: '919000000005', participants: ['919000000006'], operation: 'add' }, { token })).status, 400);
        await call(`/accounts/${extra}/pause`, {}); assert.equal((await automation.record(extra)).autoConnect, false);
    });
    await t.test('keyword matching respects context, exclusions, priorities, cooldown and duplicate event IDs', async () => {
        await call('/rules', { name: 'Pickup', gatewayId: extra, keyword: 'pickup', match: 'contains', context: 'private', enabled: true, priority: 10, blacklist: ['919000000006'], payload: { text: 'Pickup details' } });
        const inbound = { key: { id: 'duplicate', remoteJid: '919000000005@s.whatsapp.net', fromMe: false }, message: { conversation: 'My PICKUP?' } };
        const before = (await automation.listJobs()).length;
        await Promise.all([automation.handleAccountIncoming(extra, inbound), automation.handleAccountIncoming(extra, inbound)]);
        assert.equal((await automation.listJobs()).length, before + 1);
        await automation.handleAccountIncoming(extra, { ...inbound, key: { ...inbound.key, id: 'cooldown' } }); assert.equal((await automation.listJobs()).length, before + 1);
        assert.equal(await automation.keywordReply(extra, '919000000006@s.whatsapp.net', 'pickup'), false);
        assert.equal(await automation.keywordReply(extra, '123456789@g.us', 'pickup'), false);
        await call(`/accounts/${extra}/connect`, {}); await tick(); assert.equal(sent.at(-1).content.text, 'Pickup details');
    });
    await t.test('paused and claimed CRM chats cannot receive queued keyword replies', async () => {
        await call('/rules', { name: 'CRM pickup', keyword: 'pickup-test', match: 'exact', context: 'private', enabled: true, payload: { text: 'Verified pickup rule' } });
        await workspace.handleIncoming({ key: { id: 'crm-rule', remoteJid: '919000000007@s.whatsapp.net', fromMe: false }, pushName: 'Rule customer', message: { conversation: 'pickup-test' } });
        const [chat] = await db.select().from(schema.conversations).where(eq(schema.conversations.wa_number, '919000000007'));
        const [job] = (await automation.listJobs()).filter(item => JSON.parse(item.payload).conversationId === chat.id);
        assert(job); await db.update(schema.conversations).set({ ai_paused: true, ai_revision: 1 }).where(eq(schema.conversations.id, chat.id));
        const count = sent.length; await tick(); assert.equal(sent.length, count);
        const [canceled] = await db.select().from(schema.automationJobs).where(eq(schema.automationJobs.id, job.id)); assert.equal(canceled.state, 'canceled');
        await workspace.handleIncoming({ key: { id: 'crm-paused', remoteJid: '919000000007@s.whatsapp.net', fromMe: false }, message: { conversation: 'pickup-test' } });
        assert.equal((await automation.listJobs()).filter(item => JSON.parse(item.payload).conversationId === chat.id).length, 1);
    });
    await t.test('signed n8n events retry with stable IDs, redact secrets, and reject private URLs', async () => {
        const secret = 'mock-signing-secret-123456789';
        const webhook = await call('/webhooks', { name: 'n8n', url: 'https://hooks.example.test/tripanza', secret, enabled: true, events: ['connection'] });
        const overview = await call('/overview'); assert(!JSON.stringify(overview).includes(secret));
        webhookFails = true; await automation.publishEvent(extra, 'connection', { status: 'connected' }); await tick(); webhookFails = false;
        const first = requests.at(-1); assert.equal(first.options.headers['X-Tripanza-Signature'], 'sha256=' + crypto.createHmac('sha256', secret).update(first.options.body).digest('hex'));
        const queued = (await automation.listJobs()).find(job => JSON.parse(job.payload).webhookId === webhook.id); assert.equal(queued.state, 'queued');
        await db.update(schema.automationJobs).set({ due_at: past }).where(eq(schema.automationJobs.id, queued.id)); await tick();
        assert.equal(requests.at(-1).options.headers['X-Tripanza-Event-ID'], first.options.headers['X-Tripanza-Event-ID']);
        assert.equal((await db.select().from(schema.automationJobs).where(eq(schema.automationJobs.id, queued.id)))[0].state, 'sent');
        assert.equal((await api('/api/automation/webhooks', { name: 'private', url: 'https://127.0.0.1/hook', secret, enabled: true, events: ['connection'] }, { token })).status, 400);
        for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '::1', '::ffff:127.0.0.1', 'fe80::1']) assert.equal(transport.publicAddress(address), false);
    });
    await t.test('Meta credentials are encrypted, webhook signatures verified, and reply buttons use the official payload', async () => {
        const appSecret = 'mock-meta-app-secret-123456789', accessToken = 'mock-meta-access-token-123456789', verifyToken = 'mock-verification-token';
        const cloud = (await call('/accounts', { name: 'Official Meta', type: 'cloud', phoneNumberId: '123456789', apiVersion: 'v23.0', appSecret, accessToken, verifyToken })).id;
        const stored = await automation.record(cloud); assert(!JSON.stringify(stored).includes(accessToken));
        const overview = await call('/overview'); assert(!JSON.stringify(overview).includes(appSecret)); assert(!JSON.stringify(overview).includes(accessToken));
        const verified = await fetch(origin + `/api/automation/meta/webhook/${cloud}?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=12345`); assert.equal(await verified.text(), '12345');
        const body = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '123456789' }, messages: [{ id: 'meta-inbound', from: '919000000008', timestamp: String(Math.floor(clock / 1000)), text: { body: 'Hello' } }] } }] }] });
        const unsigned = await fetch(origin + `/api/automation/meta/webhook/${cloud}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); assert.equal(unsigned.status, 403);
        const signed = await fetch(origin + `/api/automation/meta/webhook/${cloud}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex') }, body }); assert.equal(signed.status, 200);
        const key = await campaign({ text: 'Which trip?', buttons: [{ kind: 'reply', label: 'Group trip', value: 'Group trip' }, { kind: 'reply', label: 'Private trip', value: 'Private trip' }] }, '919000000008', cloud);
        await call(`/campaigns/${key}/start`, {}); await tick();
        const outbound = JSON.parse(requests.at(-1).options.body); assert.equal(outbound.type, 'interactive'); assert.equal(outbound.interactive.type, 'button'); assert.equal(outbound.interactive.action.buttons[1].reply.id, 'Private trip');
        const outside = await campaign({ text: 'Hello outside window' }, '919000000009', cloud); await call(`/campaigns/${outside}/start`, {}); await tick(); assert.equal((await jobByCampaign(outside)).state, 'failed'); assert.match((await jobByCampaign(outside)).error, /approved template/);
        const template = await campaign({ template: { name: 'departure_reminder', language: 'en', parameters: ['Akshay', 'Manali'] } }, '919000000009', cloud); await call(`/campaigns/${template}/start`, {}); await tick(); assert.equal(JSON.parse(requests.at(-1).options.body).type, 'template');
        assert.equal(automation.incomingText({ message: { interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: '{"id":"Private trip"}' } } } }), 'Private trip');
        assert.equal(automation.incomingText({ message: { buttonsResponseMessage: { selectedButtonId: 'Group trip' } } }), 'Group trip');
    });
    await t.test('an agent taking over during attachment preparation cancels the pending keyword response', async () => {
        await call('/rules', { name: 'Delayed attachment', keyword: 'slow-media-test', match: 'exact', context: 'private', enabled: true,
            payload: { text: 'Itinerary', media: { kind: 'document', url: 'https://files.example.test/slow.pdf', fileName: 'itinerary.pdf' } } });
        await workspace.handleIncoming({ key: { id: 'slow-incoming', remoteJid: '919000000010@s.whatsapp.net', fromMe: false }, message: { conversation: 'slow-media-test' } });
        const [chat] = await db.select().from(schema.conversations).where(eq(schema.conversations.wa_number, '919000000010'));
        let release, started;
        const gate = new Promise(resolve => { release = resolve; }); const ready = new Promise(resolve => { started = resolve; });
        transport.setAutomationTestTransport(async (url, options) => { if (url.endsWith('/slow.pdf')) { started(); await gate; } return requestTransport(url, options); });
        const count = sent.length; const processing = tick(); await ready;
        const [admin] = await db.select().from(schema.users).where(eq(schema.users.email, 'operations@example.test'));
        await db.update(schema.conversations).set({ status: 'active', claimed_by: admin.id }).where(eq(schema.conversations.id, chat.id));
        release(); await processing; transport.setAutomationTestTransport(requestTransport);
        assert.equal(sent.length, count);
        const job = (await automation.listJobs()).find(item => JSON.parse(item.payload).conversationId === chat.id);
        assert.equal(job.state, 'canceled');
    });
    await t.test('delivery receipts cannot downgrade read messages when callbacks arrive out of order', async () => {
        const key = await campaign(); await call(`/campaigns/${key}/start`, {}); await tick();
        const sentJob = await jobByCampaign(key);
        await automation.publishEvent('crm', 'message.status', { messageId: sentJob.message_id, status: 'read' });
        await automation.publishEvent('crm', 'message.status', { messageId: sentJob.message_id, status: 'delivered' });
        await automation.publishEvent('crm', 'message.status', { messageId: sentJob.message_id, status: 'failed' });
        assert.equal((await jobByCampaign(key)).state, 'read');
    });
    await t.test('disabling a rule cancels a previously queued reply instead of sending its old content', async () => {
        const rule = { name: 'Disable pending', gatewayId: extra, keyword: 'disable-rule-test', match: 'exact', context: 'private', enabled: true, payload: { text: 'This should be canceled' } };
        const created = await call('/rules', rule);
        await automation.keywordReply(extra, '919000000011@s.whatsapp.net', 'disable-rule-test');
        await call('/rules/' + created.id, { ...rule, enabled: false }, 'PUT');
        const count = sent.length; await tick(); assert.equal(sent.length, count);
        assert.equal((await automation.listJobs()).find(job => JSON.parse(job.payload).ruleId === created.id).state, 'canceled');
    });
});
