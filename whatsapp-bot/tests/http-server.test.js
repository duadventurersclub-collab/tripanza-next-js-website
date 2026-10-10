const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { safeRequestHandler, configureHttpServer } = require('../business/httpServer');

test('rejected and thrown page handlers return a safe 500 without killing subsequent HTTP requests', async t => {
    const logs = [];
    const server = http.createServer(safeRequestHandler(async (req, res) => {
        if (req.url === '/reject') { await Promise.resolve(); throw new Error('private-key-must-not-appear'); }
        if (req.url === '/throw') throw new TypeError('private-message');
        res.end('alive');
    }, { error(text) { logs.push(text); } }));
    configureHttpServer(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const route of ['/reject', '/throw']) {
        const failed = await fetch(origin + route); assert.equal(failed.status, 500); assert(!/private/.test(await failed.text()));
        const good = await fetch(origin + '/'); assert.equal(await good.text(), 'alive');
    }
    assert.equal(logs.length, 2); assert(!logs.some(text => /private-key|private-message/.test(text)));
    assert.equal(server.keepAliveTimeout, 120000); assert(server.headersTimeout > server.keepAliveTimeout);
});

test('already-started and closed responses cannot trigger another response or an unhandled rejection', async () => {
    const logs = []; let destroys = 0;
    const handler = safeRequestHandler(async () => { throw new Error('private'); }, { error(text) { logs.push(text); } });
    await handler({}, { headersSent: true, destroy() { destroys++; } }); assert.equal(destroys, 1);
    await handler({}, { destroyed: true, destroy() { throw new Error('must not write'); } });
    await handler({}, { writableEnded: true, destroy() { throw new Error('must not write'); } });
    assert.equal(logs.length, 3);
});

test('startup health and workspace routes respond promptly without waiting for stalled initialization', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../bot.js'), 'utf8'); let handler;
    const context = { http: { createServer(callback) { handler = callback; return {}; } }, safeRequestHandler, configureHttpServer,
        process: { env: {} }, businessWorkspace: null, workspaceReady: new Promise(() => {}),
        isWorkspaceRequest: url => url.startsWith('/login') || url.startsWith('/api/health'),
        workspaceUnavailable(res) { res.writeHead(503); res.end('Workspace unavailable'); }, console: { error() {} }, Buffer };
    vm.runInNewContext(source.slice(source.indexOf('const server = http.createServer'), source.indexOf('workspaceReady = initializeWorkspace')), context);
    const call = async (url, method = 'GET') => {
        let status, text;
        await handler({ url, method }, { writeHead(value) { status = value; }, end(value) { text = value; } });
        return { status, text };
    };
    assert.equal((await call('/healthz')).status, 503);
    assert.equal((await call('/healthz', 'HEAD')).text, undefined);
    assert.equal((await call('/login')).status, 503);
    assert.equal((await call('/api/health')).status, 503);
    context.businessWorkspace = { handleRequest(_req, res) { res.writeHead(200); res.end('ready'); } };
    assert.equal((await call('/healthz')).status, 200); assert.equal((await call('/login')).text, 'ready');
});

test('outbound oversized bodies stop buffering and never send a WhatsApp message', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../bot.js'), 'utf8'); let handler;
    vm.runInNewContext(source.slice(source.indexOf('const server = http.createServer'), source.indexOf('workspaceReady = initializeWorkspace')), {
        http: { createServer(callback) { handler = callback; return {}; } }, safeRequestHandler, configureHttpServer, Buffer,
        console: { error() {} }, async sendTextWithLinkCta() { assert.fail('Oversized input must not send'); },
    });
    const req = new EventEmitter(); req.method = 'POST'; req.url = '/api/send'; let status, body;
    await handler(req, { writeHead(value) { status = value; }, end(value) { body = JSON.parse(value); } });
    req.emit('data', Buffer.alloc(65537, 97));
    // Excess chunks are ignored rather than retained or even decoded.
    req.emit('data', { toString() { assert.fail('Excess input was buffered'); } });
    await req.listeners('end')[0](); assert.equal(status, 413); assert.equal(body.success, false);
});

test('outbound itinerary request sends a PDF document on the notifications account', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../bot.js'), 'utf8'); let handler; let sent;
    vm.runInNewContext(source.slice(source.indexOf('const server = http.createServer'), source.indexOf('workspaceReady = initializeWorkspace')), {
        http: { createServer(callback) { handler = callback; return {}; } }, safeRequestHandler, configureHttpServer, Buffer,
        API_KEY: 'test', safeKeyMatch: key => key === 'test', sockNotifications: { async sendMessage(jid, content) { sent = { jid, content }; } },
        isConnectedNotifications: true, sockCRM: null, isConnectedCRM: false,
        tripanzaPdfUrl: require('../outboundDocument').tripanzaPdfUrl,
        async loadTripanzaPdf() { return Buffer.from('%PDF-1.7'); },
        console: { log() {}, error() {} },
    });
    const request = new EventEmitter(); request.method = 'POST'; request.url = '/api/send';
    const reply = new Promise(resolve => {
        handler(request, { writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, body: JSON.parse(body) }); } });
    });
    request.emit('data', JSON.stringify({ api_key: 'test', bot: 'notifications', phone: '9876543210',
        message: 'Your itinerary', document_url: 'https://tripanza.com/tours/test/?generate_pdf=1&pdf_ready=1',
        document_name: 'test-itinerary.pdf' }));
    request.emit('end');
    assert.equal((await reply).status, 200);
    assert.equal(sent.jid, '919876543210@s.whatsapp.net');
    assert.equal(sent.content.mimetype, 'application/pdf');
    assert.equal(sent.content.fileName, 'test-itinerary.pdf');
    assert.equal(sent.content.document.toString(), '%PDF-1.7');
});
