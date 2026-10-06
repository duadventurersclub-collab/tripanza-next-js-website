const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');

test('casual messages cannot enter the human queue through tool calls, empty responses or provider failures', { timeout: 30000 }, async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tripanza-handoff-test-'));
  const requests = [], sent = [];
  let mode = 'tool';
  const provider = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body); requests.push(input);
    res.setHeader('Content-Type', 'application/json');
    if (mode === 'failure') { res.writeHead(401); res.end(JSON.stringify({ error: { message: 'Fixture failure' } })); return; }
    const message = mode === 'tool' ? { role: 'assistant', content: null, tool_calls: [{ id: 'mock-transfer', type: 'function', function: { name: 'transfer_to_cs', arguments: '{}' } }] }
      : { role: 'assistant', content: mode === 'empty' ? '' : mode === 'claim' ? "I'll connect you with the Tripanza team. An agent will reply shortly." : 'Hey 🙂 What trip do you have in mind?' };
    res.end(JSON.stringify({ id: 'mock', object: 'chat.completion', choices: [{ index: 0, finish_reason: mode === 'tool' ? 'tool_calls' : 'stop', message }] }));
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  Object.assign(process.env, {
    NODE_ENV: 'test', BUSINESS_DATA_DIR: dataDir, BUSINESS_ADMIN_EMAIL: 'preview@example.test', BUSINESS_ADMIN_PASSWORD: crypto.randomBytes(18).toString('base64url'),
    APP_SECRET: crypto.randomBytes(48).toString('hex'), REFRESH_SECRET: crypto.randomBytes(48).toString('hex'),
    BUSINESS_WORKSPACE_ENABLED: 'true', BUSINESS_AI_MODE: 'workspace', WEBSITE_KNOWLEDGE_ENABLED: 'false', RATE_LIMIT_ENABLED: 'false',
    AI_API_KEY: 'isolated-fixture-key', AI_MODEL: 'fixture', AI_BASE_URL: `http://127.0.0.1:${provider.address().port}/v1`,
  });
  const server = http.createServer();
  const { initializeWorkspace } = require('../business/runtime');
  const workspace = await initializeWorkspace(server, {
    async status() { return { status: 'connected', qr: null }; },
    async send(jid, content) { const result = { key: { id: crypto.randomUUID(), remoteJid: jid, fromMe: true } }; sent.push({ jid, content }); return result; },
    async download() { return null; }, async connect() {}, async disconnect() {},
  }, { apiOnly: true });
  t.after(async () => { await workspace.close(); server.closeAllConnections(); provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)); });
  const { getConversations } = await import('../business/backend/dist/services/conversation.js');
  const { config } = await import('../business/backend/dist/config.js');
  const { db, schema } = await import('../business/backend/dist/db/index.js');
  const policy = await import('../business/backend/dist/services/handoffPolicy.js');
  let number = 0;
  async function send(message) {
    const phone = `91990000${String(++number).padStart(4, '0')}`;
    await workspace.handleIncoming({ key: { remoteJid: `${phone}@s.whatsapp.net`, id: crypto.randomUUID(), fromMe: false }, pushName: 'Fixture traveller', message: { conversation: message } });
    return (await getConversations({})).conversations.find(chat => chat.wa_number === phone);
  }
  const lyrics = 'Teri Hi Khatir Loon Sau Janam Main Chahe Jo Ho Bhi piya';
  await t.test('the screenshot lyric is redirected even if the model ignores its advertised tools', async () => {
    const chat = await send(lyrics);
    assert.equal(chat.status, 'bot'); assert.match(sent.at(-1).content.text, /Trip planning/);
    assert.doesNotMatch(sent.at(-1).content.text, /connect|agent|queue|shortly/i);
    assert.equal(requests.at(-1).tools, undefined);
  });
  await t.test('unrelated transfer claims and empty replies do not force a handoff', async () => {
    for (const value of ['claim', 'empty']) {
      mode = value; const chat = await send('🙂'); assert.equal(chat.status, 'bot'); assert.doesNotMatch(sent.at(-1).content.text, /connect|agent|queue|shortly/i);
    }
    mode = 'normal'; const chat = await send('hello'); assert.equal(chat.status, 'bot'); assert.equal(sent.at(-1).content.text, 'Hey 🙂 What trip do you have in mind?');
  });
  await t.test('missing AI credentials and rejected API requests keep casual chats with the bot', async () => {
    const key = config.ai.apiKey;
    try { config.ai.apiKey = ''; const before = requests.length; assert.equal((await send(lyrics)).status, 'bot'); assert.equal(requests.length, before); }
    finally { config.ai.apiKey = key; }
    mode = 'failure'; assert.equal((await send('hello')).status, 'bot'); assert.doesNotMatch(sent.at(-1).content.text, /agent|queue|shortly/i);
  });
  await t.test('keywords match whole phrases instead of substrings inside unrelated words', async () => {
    assert.equal(policy.matchesEscalationKeyword('I love physics', 'cs'), false);
    assert.equal(policy.matchesEscalationKeyword('managerial studies', 'manager'), false);
    assert.equal(policy.matchesEscalationKeyword('please, human agent!', 'human agent'), true);
    await db.update(schema.botConfig).set({ escalation_keywords: 'cs,manager' });
    mode = 'tool'; assert.equal((await send('I love physics')).status, 'bot');
  });
  await t.test('explicit human requests, configured keywords and real booking problems still enter the queue', async () => {
    const before = requests.length;
    assert.equal((await send('I want to talk to a human agent')).status, 'waiting'); assert.equal(requests.length, before);
    assert.equal((await send('manager')).status, 'waiting');
    assert.equal((await send('My Tripanza booking payment failed')).status, 'waiting');
    assert.match(sent.at(-1).content.text, /queue/); assert.doesNotMatch(sent.at(-1).content.text, /shortly|soon/i);
  });
  await t.test('a previously discussed trip does not authorize a handoff for a later unrelated message', () => {
    const history = [{ role: 'user', content: 'Manali trip prices please' }, { role: 'assistant', content: 'Here are the departure details.' }];
    assert.equal(policy.teamAssistanceRelevant(lyrics, [{ slug: 'manali', title: 'Manali Trip', destination: 'Manali', url: 'https://tripanza.com/tour/manali/' }], history), false);
    assert.doesNotMatch(policy.casualRedirect(lyrics, history), /kahan|dates|people|agent|queue/i);
    assert.equal(policy.teamAssistanceRelevant('yes', [], [{ role: 'assistant', content: 'Would you like me to connect you with the team?' }]), true);
    assert.equal(policy.teamAssistanceRelevant('yes', [], [{ role: 'assistant', content: 'Would you like the itinerary?' }]), false);
  });
});
