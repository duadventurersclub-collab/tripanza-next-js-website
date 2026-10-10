const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { renderDashboard, renderBotPage } = require('../frontend');

const workspaceRoutes = /^\/(?:workspace|login|admin|cs|_next|uploads)(?:\/|\?|$)|^\/(?:sw\.js|manifest\.json|favicon\.ico|icon-[^/]+)(?:\?|$)|^\/api\/(?:auth|conversations|customers|admin|notifications|gateway|health|automation)(?:\/|\?|$)/;
const gatewayPages = /^\/(?:qr-(?:crm|notifications)\/?)?(?:\?|$)/;
function isWorkspaceRequest(url = '') { return workspaceRoutes.test(url) || gatewayPages.test(url); }

function prepareEnvironment() {
    const dataDir = process.env.BUSINESS_DATA_DIR || path.join(__dirname, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    const secretFile = path.join(dataDir, 'credentials.json');
    let credentials;
    if (fs.existsSync(secretFile)) credentials = JSON.parse(fs.readFileSync(secretFile, 'utf8'));
    else {
        credentials = {
            appSecret: crypto.randomBytes(48).toString('hex'),
            refreshSecret: crypto.randomBytes(48).toString('hex'),
            adminEmail: process.env.BUSINESS_ADMIN_EMAIL || 'admin@tripanza.local',
            adminPassword: process.env.BUSINESS_ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url'),
        };
        fs.writeFileSync(secretFile, JSON.stringify(credentials, null, 2), { mode: 0o600, flag: 'wx' });
    }
    process.env.APP_SECRET ||= credentials.appSecret;
    process.env.REFRESH_SECRET ||= credentials.refreshSecret;
    process.env.BUSINESS_ADMIN_EMAIL ||= credentials.adminEmail;
    process.env.BUSINESS_ADMIN_PASSWORD ||= credentials.adminPassword;
    process.env.DB_PATH ||= pathToFileURL(path.join(dataDir, 'workspace.db')).href;
    process.env.BUSINESS_UPLOAD_DIR ||= path.join(dataDir, 'uploads');
    process.env.FRONTEND_URL ||= process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
    process.env.TIMEZONE ||= 'Asia/Calcutta';
    return secretFile;
}

async function initializeWorkspace(server, adapter, { apiOnly = false } = {}) {
    if (process.env.BUSINESS_WORKSPACE_ENABLED === 'false') return null;
    const entry = path.join(__dirname, 'backend', 'dist', 'integration.js');
    if (!fs.existsSync(entry)) throw new Error('Run npm run install:business and npm run build to prepare the team workspace.');
    const secretFile = prepareEnvironment();
    const { createBusinessWorkspace } = await import(pathToFileURL(entry).href);
    const backend = await createBusinessWorkspace(server, adapter, { renderDashboard, renderBotPage });
    let nextApp;
    let nextHandler;
    if (!apiOnly) {
        try {
            const next = require('./frontend/node_modules/next');
            nextApp = next({ dir: path.join(__dirname, 'frontend'), dev: false, hostname: 'localhost', port: Number(process.env.PORT || 3000) });
            await nextApp.prepare();
            nextHandler = nextApp.getRequestHandler();
        } catch (error) { await backend.close(); throw error; }
    }
    console.log(`[workspace] Ready at /workspace. Initial administrator credentials: ${secretFile}`);
    return {
        ...backend,
        handleRequest(req, res) {
            if (req.url === '/workspace' || req.url === '/workspace/') {
                res.writeHead(302, { Location: '/login' }); res.end(); return;
            }
            if (gatewayPages.test(req.url) || req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) return backend.app(req, res);
            if (nextHandler) return nextHandler(req, res);
            res.writeHead(503); res.end('Frontend is not running.');
        },
        async close() { await backend.close(); if (nextApp) await nextApp.close(); },
    };
}

function workspaceUnavailable(res) {
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '10' });
    res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tripanza workspace</title></head><body style="font-family:Segoe UI,sans-serif;background:#f7f9f6;color:#182e29;max-width:520px;margin:80px auto;padding:24px"><h1>Team workspace is unavailable.</h1><p>The workspace could not start. Check the deployment logs for setup instructions, then redeploy the app.</p><a href="/">Back to dashboard</a></body></html>');
}

module.exports = { initializeWorkspace, isWorkspaceRequest, workspaceUnavailable };
