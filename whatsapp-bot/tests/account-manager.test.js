const test = require('node:test');
const assert = require('node:assert/strict');
const { createAccountManager } = require('../business/accounts');
const { sendInteractive } = require('../business/buttons');

test('extra account controls isolate sockets, retain pairing on pause, release removed sockets and limit group payloads', async () => {
    const created = [], received = [], sent = [];
    const manager = createAccountManager({ root: 'mock-root', builtins: {}, onIncoming: (id, message) => received.push({ id, message }) }, {
        createConnection(config) {
            const entry = { config, pauses: 0, logouts: 0, async start() { config.onState({ socket: {
                user: { id: '919000000001@s.whatsapp.net' },
                async sendMessage(jid, content) { sent.push({ name: config.name, jid, content }); return { key: { id: 'mock-sent', remoteJid: jid } }; },
                async groupFetchAllParticipating() { return Object.fromEntries(Array.from({ length: 250 }, (_, i) => [i, { id: `${123456789 + i}@g.us`, subject: 'Mock group', participants: [{ id: 'private-member' }] }])); },
            }, connection: 'open', qr: null }); },
            async pause() { this.pauses++; config.onState({ socket: null, connection: 'close', qr: null }); },
            async disconnect() { this.logouts++; config.onState({ socket: null, connection: 'close', qr: null }); },
            };
            created.push(entry); return entry;
        },
    });
    const first = 'account_' + 'a'.repeat(32), second = 'account_' + 'b'.repeat(32);
    assert.equal((await manager.status(first)).status, 'disconnected'); assert.equal(created.length, 0);
    await manager.action(first, 'connect'); await manager.action(second, 'connect');
    await manager.send(second, '919000000002@s.whatsapp.net', { text: 'Trip details' }); assert.equal(sent[0].name, second);
    const incoming = { key: { id: 'inbound', fromMe: false }, message: { conversation: 'Hello' } };
    await created[0].config.onMessages({}, { messages: [incoming, { ...incoming, key: { fromMe: true } }], type: 'notify' }); assert.equal(received.length, 1); assert.equal(received[0].id, first);
    const groups = await manager.groups(first, 'list'); assert.equal(groups.length, 200); assert.equal(groups[0].size, 1); assert.equal(groups[0].participants, undefined);
    await manager.action(first, 'pause'); assert.equal(created[0].pauses, 1); assert.equal(created[0].logouts, 0);
    await manager.action(first, 'remove'); await manager.action(first, 'connect'); assert.equal(created.length, 3);
    await assert.rejects(manager.action('../auth_crm', 'connect'), /Invalid/);
    await manager.close(); assert.equal(created[1].pauses, 1); assert.equal(created[2].pauses, 1);
});

test('experimental buttons keep the readable message even when the interactive relay is rejected', async () => {
    const actions = [];
    const socket = { user: { id: '919000000001@s.whatsapp.net' },
        async sendMessage(jid, content) { actions.push({ kind: 'plain', content }); return { key: { id: 'accepted', remoteJid: jid } }; },
        async relayMessage(jid, message) { actions.push({ kind: 'card', message }); throw new Error('mock unsupported client'); },
    };
    const sent = await sendInteractive(socket, '919000000002@s.whatsapp.net', { text: 'View itinerary: https://tripanza.com/tour/manali/', __interactiveButtons: [{ kind: 'url', label: 'Open itinerary', value: 'https://tripanza.com/tour/manali/' }] });
    assert.equal(sent.key.id, 'accepted'); assert.equal(actions[0].kind, 'plain'); assert.equal(actions[0].content.__interactiveButtons, undefined);
    assert.equal(actions[1].kind, 'card');
    assert.equal(actions[1].message.viewOnceMessage.message.interactiveMessage.nativeFlowMessage.buttons[0].name, 'cta_url');
});
