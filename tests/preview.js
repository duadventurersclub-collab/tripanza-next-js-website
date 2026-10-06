// Isolated visual preview: no WhatsApp sockets or external AI providers.
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { renderDashboard, renderBotPage } = require('../frontend');
const { initializeWorkspace, isWorkspaceRequest } = require('../business/runtime');

(async () => {
    process.env.PORT = '3099';
    process.env.NODE_ENV = 'test';
    process.env.BUSINESS_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tripanza-preview-'));
    process.env.BUSINESS_ADMIN_EMAIL = 'preview@example.test';
    process.env.BUSINESS_ADMIN_PASSWORD = crypto.randomBytes(18).toString('base64url');
    process.env.AI_API_KEY = '';
    process.env.WEBSITE_KNOWLEDGE_ENABLED ||= 'false';
    let workspace;
    const server = http.createServer((req, res) => {
        if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(renderDashboard(true, true)); }
        if (req.url.startsWith('/qr-')) { res.setHeader('Content-Type', 'text/html'); return res.end(renderBotPage(req.url.startsWith('/qr-crm'), 'connected')); }
        if (workspace && isWorkspaceRequest(req.url)) return workspace.handleRequest(req, res);
        res.writeHead(404); res.end();
    });
    workspace = await initializeWorkspace(server, {
        async status() { return { status: 'connected', qr: null }; },
        async send(jid, content) { return { key: { remoteJid: jid, id: crypto.randomUUID(), fromMe: true }, message: { conversation: content.text || content.caption || '' } }; },
        async download() { return null; }, async connect() {}, async disconnect() {},
    });
    for (const [phone, name, text] of [['919000000101', 'Aarav Sharma', 'I would love to plan a trip to Manali.'], ['919000000102', 'Priya Singh', 'Can your team help with a group booking?'], ['919000000103', 'Rohan Mehta', 'Can I speak to someone about my itinerary?']]) {
        await workspace.handleIncoming({ key: { remoteJid: `${phone}@s.whatsapp.net`, id: crypto.randomUUID(), fromMe: false }, pushName: name, message: { conversation: text } });
    }
    await new Promise(resolve => server.listen(3099, '127.0.0.1', resolve));
    console.log('Isolated preview at http://127.0.0.1:3099');
    // Save only the credentials-file path for the local screenshot harness.
    fs.writeFileSync(path.join(__dirname, '..', '..', 'tmp', 'tripanza-preview-credentials-path.txt'), path.join(process.env.BUSINESS_DATA_DIR, 'credentials.json'));
    async function shutdown() { await workspace.close(); server.closeAllConnections(); server.close(() => process.exit(0)); }
    process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
})().catch(error => { console.error(error); process.exitCode = 1; });
