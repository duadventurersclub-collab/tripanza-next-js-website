const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { resolveAuthFolder, createRetryStore, createWhatsAppLogger, createWhatsAppConnection } = require('../business/whatsappConnection');
const { proto, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');

const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(options = {}) {
    const sockets = [], configs = [], timers = [], logs = [], states = [], received = [];
    let authCalls = 0, saveCalls = 0;
    const connection = createWhatsAppConnection({
        name: 'crm', root: os.tmpdir(), env: {},
        onState: state => states.push(state),
        onMessages: (sock, event) => received.push({ sock, event }),
    }, {
        logger: { warn(message) { logs.push(message); } },
        log: { warn(message) { logs.push(message); }, error(message) { logs.push(message); } },
        schedule(callback, delay) { const timer = { callback, delay, canceled: false }; timers.push(timer); return timer; },
        cancel(timer) { timer.canceled = true; },
        baileys: {
            DisconnectReason, Browsers, proto,
            async useMultiFileAuthState() {
                authCalls++;
                if (options.beforeAuth) await options.beforeAuth();
                return { state: { creds: {}, keys: {} }, async saveCreds() {
                    saveCalls++;
                    if (options.beforeSave) await options.beforeSave();
                } };
            },
            default(config) {
                configs.push(config);
                const sock = {
                    ev: new EventEmitter(), logoutCalls: 0, endCalls: 0,
                    async end() { this.endCalls++; },
                    async sendMessage(jid, content) {
                        if (content.fail) throw new Error('Mock rejected send');
                        return { key: { remoteJid: jid, id: content.id }, message: { conversation: content.text } };
                    },
                    async relayMessage(jid, message, { messageId }) { return messageId; },
                    async logout() { this.logoutCalls++; this.ev.emit('connection.update', close(401)); },
                };
                sockets.push(sock);
                return sock;
            },
        },
    });
    return { connection, sockets, configs, timers, logs, states, received, authCalls: () => authCalls, saveCalls: () => saveCalls };
}
function close(code) { return { connection: 'close', lastDisconnect: { error: { output: { statusCode: code } } } }; }

test('sessions migrate to the configured persistent disk without overwriting or deleting an identity', async () => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'tripanza-auth-test-'));
    try {
        const root = path.join(temporary, 'project');
        const legacy = path.join(root, 'auth_crm');
        const env = { BUSINESS_DATA_DIR: path.join(temporary, 'disk') };
        await fs.mkdir(legacy, { recursive: true });
        await fs.writeFile(path.join(legacy, 'creds.json'), '{"testIdentity":"legacy"}');
        await fs.writeFile(path.join(legacy, 'session-test.json'), '{"testSession":true}');
        assert.equal(await resolveAuthFolder('crm', { root, env: {} }), legacy);
        const destination = await resolveAuthFolder('crm', { root, env });
        assert.equal(destination, path.join(env.BUSINESS_DATA_DIR, 'whatsapp-auth', 'auth_crm'));
        assert.equal(await fs.readFile(path.join(destination, 'session-test.json'), 'utf8'), '{"testSession":true}');
        assert.equal(await fs.readFile(path.join(legacy, 'creds.json'), 'utf8'), '{"testIdentity":"legacy"}');
        await fs.writeFile(path.join(destination, 'creds.json'), '{"testIdentity":"current"}');
        assert.equal(await resolveAuthFolder('crm', { root, env }), destination);
        assert.equal(await fs.readFile(path.join(destination, 'creds.json'), 'utf8'), '{"testIdentity":"current"}');
        const custom = { ...env, WHATSAPP_AUTH_DIR: path.join(temporary, 'custom') };
        assert.equal(await resolveAuthFolder('notifications', { root, env: custom }), path.join(custom.WHATSAPP_AUTH_DIR, 'auth_notifications'));
        await fs.mkdir(path.join(custom.WHATSAPP_AUTH_DIR, 'auth_crm'));
        await assert.rejects(resolveAuthFolder('crm', { root, env: custom }), /Incomplete/);
    } finally { await fs.rm(temporary, { recursive: true, force: true }); }
});

test('retry storage preserves media protobufs, stays bounded, and never substitutes a blank message or another contact', async () => {
    let now = 10;
    const store = createRetryStore({ maxEntries: 2, ttlMs: 100, now: () => now });
    const message = proto.Message.fromObject({ imageMessage: { caption: 'Stay', mediaKey: Buffer.alloc(32, 1), fileSha256: Buffer.alloc(32, 2) } });
    store.remember({ key: { remoteJid: 'customer:3@s.whatsapp.net', id: 'media' }, message });
    const cached = await store.getMessage({ remoteJid: 'customer@s.whatsapp.net', id: 'media' });
    assert.deepEqual(proto.Message.encode(cached).finish(), proto.Message.encode(message).finish());
    assert.equal(await store.getMessage({ remoteJid: 'other@s.whatsapp.net', id: 'media' }), undefined);
    assert.equal(await store.getMessage({ remoteJid: 'customer@s.whatsapp.net', id: 'missing' }), undefined);
    store.remember({ key: { remoteJid: 'customer@s.whatsapp.net', id: 'second' }, message: { conversation: 'Two' } });
    store.remember({ key: { remoteJid: 'customer@s.whatsapp.net', id: 'third' }, message: { conversation: 'Three' } });
    assert.equal(await store.getMessage({ remoteJid: 'customer@s.whatsapp.net', id: 'media' }), undefined);
    now = 111;
    assert.equal(await store.getMessage({ remoteJid: 'customer@s.whatsapp.net', id: 'third' }), undefined);
});

test('concurrent startup creates one socket, preserves phone presence, and waits for credential writes before reconnecting', async () => {
    let releaseAuth, releaseSave;
    const authReady = new Promise(resolve => { releaseAuth = resolve; });
    const saveReady = new Promise(resolve => { releaseSave = resolve; });
    const h = harness({ beforeAuth: () => authReady, beforeSave: () => saveReady });
    const first = h.connection.start(), second = h.connection.start();
    assert.equal(first, second);
    releaseAuth();
    const sock = await first;
    assert.equal(h.authCalls(), 1);
    assert.equal(h.sockets.length, 1);
    assert.equal(h.configs[0].markOnlineOnConnect, false);
    assert.equal(h.configs[0].connectTimeoutMs, 60000);
    assert.equal(h.configs[0].syncFullHistory, false);
    for (const type of ['INITIAL_BOOTSTRAP', 'RECENT', 'PUSH_NAME', 'NON_BLOCKING_DATA']) {
        assert.equal(h.configs[0].shouldSyncHistoryMessage({ syncType: proto.HistorySync.HistorySyncType[type] }), true);
    }
    assert.equal(h.configs[0].shouldSyncHistoryMessage({ syncType: proto.HistorySync.HistorySyncType.FULL }), false);
    assert.equal(h.configs[0].enableAutoSessionRecreation, true);
    assert.equal(h.configs[0].enableRecentMessageCache, true);
    assert.equal(h.configs[0].generateHighQualityLinkPreview, false);
    assert.deepEqual(h.configs[0].browser, Browsers.ubuntu('Chrome'));
    sock.ev.emit('creds.update', {});
    await flush();
    assert.equal(h.saveCalls(), 1);
    sock.ev.emit('connection.update', close(408));
    sock.ev.emit('connection.update', close(408));
    assert.equal(h.timers.length, 1);
    const reconnect = h.connection.start();
    await flush();
    assert.equal(h.authCalls(), 1, 'New auth must not read half-saved credentials');
    releaseSave();
    const replacement = await reconnect;
    assert.notEqual(replacement, sock);
    assert.equal(h.sockets.length, 2);
    assert.equal(h.timers[0].canceled, true);
    const count = h.states.length;
    sock.ev.emit('connection.update', { connection: 'open' });
    sock.ev.emit('messages.upsert', { type: 'notify', messages: [] });
    assert.equal(h.states.length, count);
    assert.equal(h.received.length, 0);
    await assert.rejects(sock.sendMessage('customer@s.whatsapp.net', { id: 'stale', text: 'Old socket' }), /no longer active/);
    await h.connection.disconnect();
});

test('retry payloads are byte-bounded snapshots with correct replacement, expiry and clear accounting', async () => {
    const jid = 'customer@s.whatsapp.net';
    const original = { conversation: 'x'.repeat(100) };
    const size = proto.Message.encode(original).finish().byteLength;
    let now = 0;
    const store = createRetryStore({ maxBytes: size * 2, ttlMs: 100, now: () => now });
    const put = (id, message = original) => store.remember({ key: { remoteJid: jid, id }, message });
    const get = id => store.getMessage({ remoteJid: jid, id });
    put('one'); put('two'); put('three');
    assert.equal(await get('one'), undefined, 'Evict by bytes even with fewer than 2000 entries');
    assert.equal((await get('two')).conversation, original.conversation);
    original.conversation = 'mutated original';
    const result = await get('three');
    assert.equal(result.conversation, 'x'.repeat(100));
    result.conversation = 'mutated retry';
    assert.equal((await get('three')).conversation, 'x'.repeat(100));
    put('two', { conversation: 'x'.repeat(size * 3) });
    assert.equal(await get('two'), undefined, 'Oversized replacement must not serve the stale original');
    assert.equal((await get('three')).conversation, 'x'.repeat(100));
    now = 101;
    put('four', { conversation: 'x'.repeat(100) });
    put('five', { conversation: 'x'.repeat(100) });
    assert.equal(await get('three'), undefined);
    assert(await get('four'));
    assert(await get('five'));
    store.clear();
    put('six', { conversation: 'x'.repeat(100) });
    put('seven', { conversation: 'x'.repeat(100) });
    assert.equal(await get('five'), undefined);
    assert(await get('six'));
    assert(await get('seven'));
});

test('40 consecutive timeouts retain one scheduled reconnect, retire listeners, and never unlink the phone', async () => {
    const h = harness();
    let sock = await h.connection.start();
    const jid = 'customer@s.whatsapp.net';
    await sock.sendMessage(jid, { id: 'retained', text: 'Reply before timeout' });
    for (let i = 0; i < 40; i++) {
        sock.ev.emit('connection.update', close(408));
        sock.ev.emit('connection.update', close(408));
        assert.equal(sock.ev.eventNames().length, 0);
        assert.equal(sock.logoutCalls, 0);
        const pending = h.timers.filter(timer => !timer.canceled && !timer.fired);
        assert.equal(pending.length, 1);
        assert.equal(pending[0].delay, Math.min(300000, 1000 * 2 ** Math.min(i, 9)));
        pending[0].fired = true;
        pending[0].callback();
        await flush();
        assert.equal(h.sockets.length, i + 2);
        sock = h.sockets.at(-1);
        assert.equal(h.connection.isCurrent(sock), true);
    }
    assert.equal((await h.configs.at(-1).getMessage({ remoteJid: jid, id: 'retained' })).conversation, 'Reply before timeout');
    sock.ev.emit('connection.update', { connection: 'open' });
    sock.ev.emit('connection.update', close(408));
    assert.equal(h.timers.at(-1).delay, 1000, 'Successful connection resets the backoff');
    await h.connection.disconnect();
    assert.equal(h.timers.at(-1).canceled, true);
});

test('retry originals for incoming, sent and relayed messages survive reconnects without retrying rejected sends', async () => {
    const h = harness();
    const sock = await h.connection.start();
    const jid = 'customer@s.whatsapp.net';
    await sock.sendMessage(jid, { id: 'sent', text: 'Accepted reply' });
    await sock.relayMessage(jid, { documentMessage: { fileName: 'itinerary.pdf', mediaKey: Buffer.alloc(32) } }, { messageId: 'pdf' });
    sock.ev.emit('messages.upsert', { type: 'notify', messages: [{ key: { remoteJid: jid, id: 'incoming' }, message: { conversation: 'Customer question' } }] });
    await assert.rejects(sock.sendMessage(jid, { id: 'failed', fail: true }));
    sock.ev.emit('connection.update', close(515));
    assert.equal(h.timers[0].delay, 250);
    await h.connection.start();
    const get = h.configs[1].getMessage;
    assert.equal((await get({ remoteJid: jid, id: 'sent' })).conversation, 'Accepted reply');
    assert.equal((await get({ remoteJid: jid, id: 'pdf' })).documentMessage.fileName, 'itinerary.pdf');
    assert.equal((await get({ remoteJid: jid, id: 'incoming' })).conversation, 'Customer question');
    assert.equal(await get({ remoteJid: jid, id: 'failed' }), undefined);
    await h.connection.disconnect();
    assert.equal(await get({ remoteJid: jid, id: 'incoming' }), undefined);
});

test('an immediate close after startup can create a replacement instead of returning the closed startup promise', async () => {
    const h = harness();
    const first = await h.connection.start();
    first.ev.emit('connection.update', close(515));
    const replacement = await h.connection.start();
    assert.notEqual(first, replacement);
    assert.equal(h.sockets.length, 2);
    await h.connection.disconnect();
});

test('logout, duplicate-session and invalid-session closes stop instead of fighting another connection', async () => {
    for (const code of [401, 440, 500, 411, 403]) {
        const h = harness();
        const sock = await h.connection.start();
        sock.ev.emit('connection.update', close(code));
        assert.equal(h.timers.length, 0);
        assert.equal(h.connection.isCurrent(sock), false);
        assert.equal(sock.logoutCalls, 0, 'A server error must not unlink the account');
        assert.match(h.logs.at(-1), new RegExp(String(code)));
        await h.connection.disconnect();
    }
});

test('intentional disconnect cancels pending reconnects and in-flight startup without creating or logging out a new socket', async () => {
    const h = harness();
    const sock = await h.connection.start();
    sock.ev.emit('connection.update', close(408));
    await h.connection.disconnect();
    assert.equal(h.timers[0].canceled, true);
    h.timers[0].callback();
    await flush();
    assert.equal(h.sockets.length, 1);
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    const pending = harness({ beforeAuth: () => ready });
    const start = pending.connection.start();
    const stop = pending.connection.disconnect();
    release();
    assert.equal(await start, null);
    await stop;
    assert.equal(pending.sockets.length, 0);
    const active = harness();
    const connected = await active.connection.start();
    await active.connection.disconnect();
    assert.equal(connected.logoutCalls, 1);
    assert.equal(active.timers.length, 0);
});

test('protocol diagnostics do not log encryption keys, message bodies or raw provider errors', () => {
    const warnings = [];
    const logger = createWhatsAppLogger('crm', require('pino'), { warn(value) { warnings.push(value); } });
    logger.error({ err: { message: 'SECRET', key: 'PRIVATE' }, message: { conversation: 'CUSTOMER_TEXT' } }, 'failed to decrypt message');
    logger.warn({ node: { key: 'PRIVATE' } }, 'Failed to send retry');
    assert.equal(warnings.length, 2);
    for (const warning of warnings) assert(!/SECRET|PRIVATE|CUSTOMER_TEXT/.test(warning));
    assert.match(warnings[0], /decryption/);
});

test('pausing a managed connection closes the transport without unlinking the phone and can resume', async () => {
    const h = harness();
    const socket = await h.connection.start();
    await h.connection.pause();
    assert.equal(socket.endCalls, 1); assert.equal(socket.logoutCalls, 0);
    assert.equal(socket.ev.eventNames().length, 0);
    assert.equal(h.timers.length, 0);
    const resumed = await h.connection.start(); assert.notEqual(resumed, socket);
    await h.connection.disconnect();
});

test('failed startup is reported safely and temporary failures back off until a successful connection', async () => {
    let fail = true;
    const h = harness({ beforeAuth() { if (fail) throw new Error('PRIVATE_AUTH_ERROR'); } });
    await assert.rejects(h.connection.start());
    await flush();
    assert.equal(h.timers[0].delay, 1000);
    assert(h.logs.every(value => !value.includes('PRIVATE_AUTH_ERROR')));
    fail = false;
    h.timers[0].callback();
    await flush();
    const sock = h.sockets[0];
    assert(sock);
    sock.ev.emit('connection.update', close(408));
    assert.equal(h.timers[1].delay, 2000);
    const replacement = await h.connection.start();
    replacement.ev.emit('connection.update', { connection: 'open' });
    replacement.ev.emit('connection.update', close(408));
    assert.equal(h.timers[2].delay, 1000);
    await h.connection.disconnect();
});

test('root startup and the workspace use the same managed CRM connection, with no notification chatbot', async () => {
    const vm = require('node:vm');
    const source = await fs.readFile(path.join(__dirname, '..', 'bot.js'), 'utf8');
    const connections = [];
    let adapter;
    vm.runInNewContext(source, {
        __dirname: path.join(__dirname, '..'), Buffer,
        process: { env: {}, loadEnvFile() {} },
        console: { log() {}, warn() {}, error() {} },
        setInterval() { return { unref() {} }; }, setTimeout,
        require(name) {
            if (name === './business/whatsappConnection') return {
                createWhatsAppConnection(config) {
                    const connection = { config, starts: 0, disconnects: 0,
                        async start() { this.starts++; }, async disconnect() { this.disconnects++; }, isCurrent() { return true; } };
                    connections.push(connection); return connection;
                },
            };
            if (name === './business/runtime') return {
                initializeWorkspace(server, gateway) { adapter = gateway; return Promise.resolve(null); },
                isWorkspaceRequest() { return false; }, workspaceUnavailable() {},
            };
            if (name === './frontend') return {};
            if (name === './business/httpServer') return require('../business/httpServer');
            if (name === './business/runtimeDiagnostics') return { startRuntimeDiagnostics() { return { report() {} }; } };
            if (name === './business/accounts') return require('../business/accounts');
            if (name === 'http') return { createServer() { return { listen(port, host, callback) { assert.equal(host, '0.0.0.0'); callback(); } }; } };
            if (name === 'axios' || name === 'qrcode') return {};
            return require(name);
        },
    });
    assert.deepEqual(connections.map(connection => connection.config.name), ['notifications', 'crm']);
    assert.equal(typeof connections[0].config.onMessages, 'function');
    assert.equal(typeof connections[1].config.onMessages, 'function');
    assert.equal(connections[0].starts, 1);
    assert.equal(connections[1].starts, 1);
    await adapter.connect();
    assert.equal(connections[1].starts, 2);
    await adapter.disconnect();
    assert.equal(connections[1].disconnects, 1);
    assert.equal(connections[0].disconnects, 0);
});
