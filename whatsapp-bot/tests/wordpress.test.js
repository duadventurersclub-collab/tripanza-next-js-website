const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

test('WordPress actions: protected settings, real receipts, booking review and duplicate protection', { timeout: 45000 }, async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tripanza-wp-test-'));
  const password = crypto.randomBytes(18).toString('base64url'), secret = crypto.randomBytes(32).toString('hex');
  let siteOrigin, mode = 'email', capabilities = { email: true, booking: true }, failMail = false, badPayment = false, changedPrice = false;
  let pauseQuote = false, notifyQuote, releaseQuote;
  const requests = [], sent = [], orders = new Map(), emails = new Map(), aiRequests = [];
  function tour() { return { slug: 'manali-trip', status: 'publish', title: 'Manali Trip', link: `${siteOrigin}/tour/manali-trip/`, details: { destination: 'Manali', origin: 'Delhi', pricing: { quad: { amount: 7500, display: '₹7,500 / person' } }, departures: [{ date: '2099-10-16', status: 'Seats available' }], excluded: ['Lunch'], itinerary: [{ day: 1, title: 'Depart Delhi' }] } }; }
  const site = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/wp-json/tripanza-headless/v1/tours')) { res.end(JSON.stringify(req.url.endsWith('/manali-trip') ? tour() : { items: [tour()], total_pages: 1 })); return; }
    if (!req.url.startsWith('/wp-json/tripanza-workspace/v1/')) { res.writeHead(404); res.end('{}'); return; }
    assert.equal(req.headers['x-tripanza-workspace-token'], secret);
    let text = ''; for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) : null; requests.push({ url: req.url, body });
    if (req.url.endsWith('/capabilities')) { res.end(JSON.stringify({ version: 1, ...capabilities, site: siteOrigin })); return; }
    if (req.url.endsWith('/quote')) {
      if (pauseQuote) { notifyQuote(); await new Promise(resolve => { releaseQuote = resolve; }); }
      res.end(JSON.stringify({ title: 'Manali Trip', travellers: body.quad + body.triple + body.twin, total: 30000, advance: 6000, currency: 'INR' })); return;
    }
    assert.equal(req.url, '/wp-json/tripanza-workspace/v1/actions');
    if (body.kind === 'email') {
      if (!emails.has(body.request_id)) emails.set(body.request_id, { success: !failMail, kind: 'email', email: body.email, title: 'Manali Trip', status: failMail ? 'failed' : 'accepted' });
      res.end(JSON.stringify(emails.get(body.request_id))); return;
    }
    if (changedPrice) { res.writeHead(409); res.end(JSON.stringify({ error: 'Price changed' })); return; }
    if (!orders.has(body.request_id)) orders.set(body.request_id, { success: true, kind: 'booking', order_id: String(1000 + orders.size), status: 'pending_payment', total: 30000, advance: 6000, currency: 'INR', payu_url: `${badPayment ? 'https://outside.invalid' : siteOrigin}/advance-payu-payment/?order_id=${1000 + orders.size}`, upi_url: `${siteOrigin}/advance-upi-payment?order_id=${1000 + orders.size}` });
    res.end(JSON.stringify(orders.get(body.request_id)));
  });
  await new Promise(resolve => site.listen(0, '127.0.0.1', resolve)); siteOrigin = `http://127.0.0.1:${site.address().port}`;
  const provider = http.createServer(async (req, res) => {
    let text = ''; for await (const chunk of req) text += chunk; const input = JSON.parse(text); aiRequests.push(input);
    const names = input.tools.map(t => t.function.name);
    const user = input.messages.findLast(m => m.role === 'user')?.content;
    const saved = input.messages.some(m => m.role === 'tool' && /"saved":true/.test(m.content));
    let name, args;
    if (input.messages[0].content.startsWith('REPLY_REVIEW')) { name = 'review_reply'; args = { supported: true, complete: true, conversational: true }; }
    else if (mode === 'booking' && !saved) { name = 'save_preferences'; args = { name: 'Riya Verma', email: 'riya@example.test', dates: '16/10/2099', travellers: '4 people', room_sharing: 'quad' }; }
    else if (mode === 'booking') { name = 'prepare_booking'; args = { slug: 'manali-trip', date: '16/10/2099', quad: 4, triple: 0, twin: 0 }; }
    else if (names.includes('email_itinerary')) { name = 'email_itinerary'; args = { slug: 'manali-trip' }; }
    else { name = 'respond_to_customer'; args = { response: user.includes('mail') ? 'What email address should I use for your itinerary?' : 'How can I help with your trip?', fact_ids: [], selected_tour: '', media: 'none', include_link: false, handoff: false }; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: 'mock', object: 'chat.completion', choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: crypto.randomUUID(), type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] }));
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  Object.assign(process.env, { WEBSITE_URL: siteOrigin, WEBSITE_KNOWLEDGE_ENABLED: 'true', BUSINESS_DATA_DIR: directory, BUSINESS_ADMIN_EMAIL: 'owner@example.test', BUSINESS_ADMIN_PASSWORD: password, APP_SECRET: crypto.randomBytes(40).toString('hex'), REFRESH_SECRET: crypto.randomBytes(40).toString('hex'), NODE_ENV: 'test', RATE_LIMIT_ENABLED: 'false', BUSINESS_AI_MODE: 'workspace', AI_API_KEY: 'mock-only', AI_BASE_URL: `http://127.0.0.1:${provider.address().port}/v1` });
  let workspace;
  const server = http.createServer((req, res) => workspace.handleRequest(req, res));
  const { initializeWorkspace } = require('../business/runtime');
  workspace = await initializeWorkspace(server, { async status() { return { status: 'connected', qr: null }; }, async send(jid, content) { sent.push({ jid, content }); return { key: { id: crypto.randomUUID(), remoteJid: jid, fromMe: true }, message: { conversation: content.text || '' } }; }, async connect() {}, async disconnect() {} }, { apiOnly: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await workspace.close(); for (const s of [server, site, provider]) { s.closeAllConnections(); await new Promise(resolve => s.close(resolve)); } });
  const { db, schema } = await import('../business/backend/dist/db/index.js');
  const { eq } = await import('../business/backend/node_modules/drizzle-orm/index.js');
  const { getCustomerByWaNumber, getConversations, findOrCreateCustomer, createConversation } = await import('../business/backend/dist/services/conversation.js');
  const actions = await import('../business/backend/dist/services/wordpress.js');
  const { getTour, syncWebsite } = await import('../business/backend/dist/services/website.js');
  const { rememberCustomerMessage, rememberPreferences } = await import('../business/backend/dist/services/memory.js');
  const { setConversationAi, deleteWorkspaceConversation } = await import('../business/backend/dist/services/conversationControls.js');
  const call = (url, method = 'GET', body, token) => fetch(origin + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const login = await (await call('/api/auth/login', 'POST', { email: 'owner@example.test', password })).json(), token = login.accessToken;
  const inbound = (phone, text, id = crypto.randomUUID()) => ({ key: { remoteJid: `${phone}@s.whatsapp.net`, id, fromMe: false }, pushName: 'Riya', message: { conversation: text } });
  const reply = () => sent.findLast(m => m.content.text)?.content.text || '';
  const bookingText = 'Book Manali Trip for 16/10/2099, 4 people, quad sharing. Name Riya Verma, email riya@example.test.';
  async function context(phone, message = bookingText) {
    const { customer } = await findOrCreateCustomer({ waNumber: phone }); const chat = await createConversation({ customerId: customer.id, waNumber: phone });
    await rememberCustomerMessage(customer.id, message);
    await rememberPreferences(customer.id, { name: 'Riya Verma', email: 'riya@example.test', dates: '16/10/2099', travellers: '4 people', room_sharing: 'quad' }, message);
    return { id: chat.id, revision: chat.ai_revision, customerId: customer.id, phone, messageId: crypto.randomUUID(), message, history: [], privateTrip: false };
  }
  await t.test('connection is owner-only, encrypted, capability-tested and downloadable as an installable ZIP', async () => {
    assert.equal((await call('/api/admin/wordpress')).status, 401);
    await call('/api/admin/users', 'POST', { name: 'Agent', email: 'agent@example.test', password, role: 'cs' }, token);
    const agent = await (await call('/api/auth/login', 'POST', { email: 'agent@example.test', password })).json();
    assert.equal((await call('/api/admin/wordpress', 'PUT', { token: secret, emailEnabled: true, bookingEnabled: true }, agent.accessToken)).status, 403);
    assert.equal((await call('/api/admin/wordpress', 'PUT', { token: 'bad', emailEnabled: true, bookingEnabled: true }, token)).status, 400);
    const saved = await (await call('/api/admin/wordpress', 'PUT', { token: secret, emailEnabled: true, bookingEnabled: true }, token)).json();
    assert.equal(saved.connected, false); assert(!JSON.stringify(saved).includes(secret));
    const credentials = await db.select().from(schema.aiCredentials); assert(credentials.every(c => !c.encrypted_key.includes(secret)));
    const tested = await (await call('/api/admin/wordpress/test', 'POST', undefined, token)).json(); assert(tested.status.emailReady && tested.status.bookingReady);
    assert(requests.every(r => r.url.endsWith('/capabilities')));
    const zip = Buffer.from(await (await call('/api/admin/wordpress/plugin', 'GET', undefined, token)).arrayBuffer());
    assert.equal(zip.readUInt32LE(0), 0x04034b50); const nameLength = zip.readUInt16LE(26), size = zip.readUInt32LE(18);
    assert.equal(zip.subarray(30, 30 + nameLength).toString(), 'tripanza-workspace-bridge/tripanza-workspace-bridge.php');
    assert.equal(zip.subarray(30 + nameLength, 30 + nameLength + size).toString(), fs.readFileSync(path.join(__dirname, '../business/wordpress/tripanza-workspace-bridge.php'), 'utf8'));
    assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
    assert.equal((await call('/api/admin/website/sources', 'PUT', { urls: [`${siteOrigin}/tour/manali-trip/`] }, token)).status, 202);
    await syncWebsite();
  });
  await t.test('the AI emails the selected itinerary only on request and reports real acceptance without claiming inbox delivery', async () => {
    mode = 'email'; const phone = '919800000001', id = crypto.randomUUID();
    await workspace.handleIncoming(inbound(phone, 'Email the Manali Trip itinerary to riya@example.test', id));
    assert.equal(emails.size, 1); assert.match(reply(), /submitted to \*riya@example.test\*/); assert.match(reply(), /inbox delivery is not yet confirmed/);
    await workspace.handleIncoming(inbound(phone, 'Email the Manali Trip itinerary to riya@example.test', id)); assert.equal(emails.size, 1);
    const customer = await getCustomerByWaNumber(phone), chats = await getConversations({}); const chat = chats.conversations.find(c => c.wa_number === phone);
    await actions.emailItinerary({ id: chat.id, revision: chat.ai_revision, customerId: customer.id, phone, messageId: (await db.select().from(schema.messages).where(eq(schema.messages.conversation_id, chat.id))).find(m => m.sender === 'customer').id, message: 'Email the Manali Trip itinerary to riya@example.test', history: [], privateTrip: false }, await getTour('manali-trip'));
    assert.equal(emails.size, 1);
    const count = requests.length; await workspace.handleIncoming(inbound('919800000002', 'I like Manali Trip, my email is riya@example.test')); assert.equal(requests.length, count);
  });
  await t.test('email failures cannot become successful delivery claims', async () => {
    failMail = true; await workspace.handleIncoming(inbound('919800000003', 'Email the Manali Trip itinerary to riya@example.test'));
    assert.match(reply(), /could not send/); assert.doesNotMatch(reply(), /submitted|check your inbox/i); failMail = false;
  });
  await t.test('booking review creates no order; explicit confirmation creates one real pending-payment order and repeated confirmation cannot duplicate it', async () => {
    mode = 'booking'; const phone = '919800000004'; await workspace.handleIncoming(inbound(phone, bookingText));
    const review = reply(); assert.match(review, /^\*Review your booking\*/); assert.match(review, /30,000/); assert.match(review, /confirm booking/); assert.equal(orders.size, 0);
    const modelCalls = aiRequests.length; await workspace.handleIncoming(inbound(phone, 'confirm booking'));
    assert.equal(aiRequests.length, modelCalls); assert.equal(orders.size, 1); assert.match(reply(), /payment pending/); assert.match(reply(), /order_id=1000/); assert.match(reply(), /before seats are confirmed/);
    await workspace.handleIncoming(inbound(phone, 'confirm booking')); assert.equal(orders.size, 1); assert.match(reply(), /already been created/);
  });
  await t.test('server rejects missing authorization, private quotes, invented dates, paused chats and edited booking details', async () => {
    const c = await context('919800000005'), tourData = await getTour('manali-trip'), args = { date: '16/10/2099', quad: 4, triple: 0, twin: 0 };
    assert.equal(actions.hasBookingIntent('How can I book?', []), false); assert.equal(actions.hasEmailIntent('Do not email my itinerary', []), false);
    await assert.rejects(actions.prepareBooking({ ...c, message: 'What is the advance policy?' }, tourData, args), /policy/);
    await assert.rejects(actions.prepareBooking({ ...c, privateTrip: true }, tourData, args), /unavailable/);
    await assert.rejects(actions.prepareBooking(c, tourData, { ...args, date: '17/10/2099' }), /explicitly supplied/);
    const review = await actions.prepareBooking(c, tourData, args);
    await rememberPreferences(c.customerId, { travellers: '3 people' }, 'Actually 3 people');
    const before = orders.size; const changed = await actions.confirmPendingBooking({ ...c, message: 'confirm booking', history: [{ role: 'assistant', content: review }] }); assert.match(changed.response, /review your latest/); assert.equal(orders.size, before);
    const owner = { sub: login.user.id, role: 'super_admin' }; await setConversationAi(c.id, true, owner);
    await assert.rejects(actions.prepareBooking(c, tourData, args), /unavailable/); assert.equal(orders.size, before);
  });
  await t.test('price changes and unsafe payment URLs do not publish payment links or create new orders on retry', async () => {
    for (const scenario of ['price', 'url']) {
      const c = await context(scenario === 'price' ? '919800000006' : '919800000007');
      const review = await actions.prepareBooking(c, await getTour('manali-trip'), { date: '16/10/2099', quad: 4, triple: 0, twin: 0 });
      changedPrice = scenario === 'price'; badPayment = scenario === 'url';
      const result = await actions.confirmPendingBooking({ ...c, message: 'confirm booking', history: [{ role: 'assistant', content: review }] });
      assert(result.shouldEscalate); assert.doesNotMatch(result.response, /https?:\/\//);
      await assert.rejects(actions.prepareBooking(c, await getTour('manali-trip'), { date: '16/10/2099', quad: 4, triple: 0, twin: 0 }), /team check/);
      changedPrice = false; badPayment = false;
    }
  });
  await t.test('deletion during quote loading cannot recreate a draft or perform an action', async () => {
    const c = await context('919800000008'); pauseQuote = true; const started = new Promise(resolve => { notifyQuote = resolve; });
    const pending = actions.prepareBooking(c, await getTour('manali-trip'), { date: '16/10/2099', quad: 4, triple: 0, twin: 0 }); await started;
    await deleteWorkspaceConversation(c.id); releaseQuote(); await assert.rejects(pending, /unavailable/); pauseQuote = false;
    assert.equal((await db.select().from(schema.workspaceActions).where(eq(schema.workspaceActions.conversation_id, c.id))).length, 0);
  });
  await t.test('missing capabilities and disconnect disable action tools immediately', async () => {
    capabilities = { email: false, booking: false }; await actions.testWordpressConnection(); const status = await actions.wordpressStatus(); assert(!status.emailReady && !status.bookingReady);
    await call('/api/admin/wordpress', 'DELETE', undefined, token); assert.equal((await actions.wordpressStatus()).configured, false);
    assert.equal((await db.select().from(schema.aiCredentials).where(eq(schema.aiCredentials.id, 'wordpress'))).length, 0);
    const audits = await db.select().from(schema.auditLog); assert(!JSON.stringify(audits).includes(secret));
  });
});
