const QRCode = require('qrcode');
const { createWhatsAppConnection } = require('./whatsappConnection');
const { sendInteractive } = require('./buttons');

function createAccountManager({ root, builtins, onIncoming, onEvent }, dependencies = {}) {
    const create = dependencies.createConnection || createWhatsAppConnection;
    const accounts = new Map();
    function valid(id) {
        if (!/^account_[a-f0-9]{32}$/.test(id)) throw new Error('Invalid WhatsApp account');
    }
    function account(id) {
        if (builtins[id]) return builtins[id];
        valid(id);
        if (accounts.has(id)) return accounts.get(id);
        const entry = { socket: null, status: 'disconnected', qr: null };
        entry.connection = create({ name: id, root,
            onEvent(event, data) { return onEvent?.(id, event, data); },
            onState({ socket, connection, qr }) {
                entry.socket = socket;
                if (qr !== undefined) entry.qr = qr;
                if (connection) entry.status = connection === 'open' ? 'connected' : connection === 'close' ? 'disconnected' : 'connecting';
                if (connection === 'open') entry.qr = null;
                if (connection === 'open' || connection === 'close') Promise.resolve(onEvent?.(id, 'connection', { status: entry.status })).catch(() => {});
            },
            async onMessages(sock, { messages, type }) {
                if (type !== 'notify') return;
                for (const message of messages) {
                    if (message.key?.fromMe) continue;
                    await onIncoming(id, message);
                }
            },
        });
        accounts.set(id, entry);
        return entry;
    }
    function socket(id) {
        const entry = account(id);
        const sock = typeof entry.socket === 'function' ? entry.socket() : entry.socket;
        if (!sock) throw new Error('WhatsApp account is offline');
        return sock;
    }
    return {
        async status(id) {
            const entry = accounts.get(id) || builtins[id];
            if (!entry) { valid(id); return { status: 'disconnected', qr: null }; }
            if (entry.status instanceof Function) return entry.status();
            return { status: entry.status, qr: entry.qr ? await QRCode.toDataURL(entry.qr, { scale: 5 }) : null };
        },
        async action(id, action) {
            const entry = account(id);
            if (action === 'connect') await entry.connection.start();
            else if (action === 'pause') await entry.connection.pause();
            else if (action === 'logout') await entry.connection.disconnect();
            else if (action === 'remove' && !builtins[id]) { await entry.connection.pause(); accounts.delete(id); }
            else throw new Error('Unknown account action');
        },
        async send(id, jid, content) { return sendInteractive(socket(id), jid, content); },
        async groups(id, action, data = {}) {
            const sock = socket(id);
            if (action === 'list') return Object.values(await sock.groupFetchAllParticipating()).slice(0, 200)
                .map(group => ({ id: group.id, subject: group.subject, size: group.size || group.participants?.length || 0 }));
            if (action === 'create') return sock.groupCreate(data.subject, data.participants);
            if (action === 'details') return sock.groupMetadata(data.jid);
            if (action === 'subject') return sock.groupUpdateSubject(data.jid, data.subject);
            if (action === 'description') return sock.groupUpdateDescription(data.jid, data.description);
            if (action === 'participants') return sock.groupParticipantsUpdate(data.jid, data.participants, data.operation);
            if (action === 'announcement') return sock.groupSettingUpdate(data.jid, data.enabled ? 'announcement' : 'not_announcement');
            throw new Error('Unknown group action');
        },
        async close() { await Promise.allSettled([...accounts.values()].map(entry => entry.connection.pause())); },
    };
}
module.exports = { createAccountManager };
