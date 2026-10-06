const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('../business/frontend/node_modules/typescript');

test('the production middleware permits automation for admins, preserves agent restrictions, and rejects unknown routes', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../business/frontend/src/middleware.ts'), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const secret = crypto.randomBytes(32).toString('hex');
    const exports = {};
    vm.runInNewContext(code, { exports, Buffer, TextEncoder, URL, AbortSignal, crypto: crypto.webcrypto,
        process: { env: { APP_SECRET: secret, PORT: '3140' } },
        require(name) { assert.equal(name, 'next/server'); return { NextResponse: { next: () => ({ allowed: true }), redirect: url => ({ location: String(url) }) } }; },
        async fetch(_url, options) { const token = options.headers.Cookie.split('=')[1]; const role = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role; return { ok: true, async json() { return { user: { role } }; } }; },
    });
    function request(route, role = 'super_admin') {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ sub: 'mock-user', type: 'access', role, exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url');
        const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
        const url = 'http://localhost:3140' + route;
        return { url, nextUrl: new URL(url), cookies: { get: () => role ? { value: `${header}.${payload}.${signature}` } : undefined } };
    }
    assert.equal((await exports.middleware(request('/admin/automation?panel=accounts'))).allowed, true);
    assert.match((await exports.middleware(request('/admin/not-a-page'))).location, /\/admin$/);
    assert.match((await exports.middleware(request('/admin/automation', null))).location, /\/login\?/);
    assert.match((await exports.middleware(request('/admin/automation', 'cs'))).location, /\/cs\?tab=mine$/);
});
