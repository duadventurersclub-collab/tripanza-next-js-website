const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

async function exists(file) {
    try { await fs.access(file); return true; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function resolveAuthFolder(name, { root, env = process.env }) {
    const legacy = path.join(root, `auth_${name}`);
    const base = env.WHATSAPP_AUTH_DIR || (env.BUSINESS_DATA_DIR && path.join(env.BUSINESS_DATA_DIR, 'whatsapp-auth'));
    if (!base) return legacy;
    await fs.mkdir(path.resolve(base), { recursive: true, mode: 0o700 });
    const destination = path.resolve(base, `auth_${name}`);
    if (destination === legacy || await exists(path.join(destination, 'creds.json'))) return destination;
    // Preserve the existing linked device when moving sessions to a disk. Never
    // merge two identities or remove the legacy keys; publish the full copy once.
    if (await exists(path.join(legacy, 'creds.json'))) {
        if (await exists(destination)) throw new Error('Incomplete WhatsApp session migration; check the auth directory.');
        await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
        const temporary = `${destination}.migrate-${crypto.randomBytes(8).toString('hex')}`;
        await fs.cp(legacy, temporary, { recursive: true, errorOnExist: true, force: false });
        await fs.chmod(temporary, 0o700);
        await fs.rename(temporary, destination);
    }
    return destination;
}

function createRetryStore({ maxEntries = 2000, maxBytes = 8 * 1024 * 1024,
    ttlMs = 24 * 60 * 60 * 1000, now = Date.now,
    messageType = require('@whiskeysockets/baileys').proto.Message } = {}) {
    const entries = new Map();
    let bytes = 0;
    const keyFor = key => key?.remoteJid && key?.id
        ? `${key.remoteJid.replace(/:\d+(?=@)/, '')}|${key.id}` : null;
    function remove(id) {
        const value = entries.get(id);
        if (value) bytes -= value.payload.byteLength;
        entries.delete(id);
    }
    function remember({ key, message } = {}) {
        const id = keyFor(key);
        if (!id || !message) return;
        remove(id);
        const timestamp = now();
        for (const [id, value] of entries) {
            if (value.expires <= timestamp) remove(id);
        }
        let encoded;
        try {
            const writer = messageType.encode(message);
            if (writer.len > maxBytes || maxEntries < 1) return;
            encoded = writer.finish();
        }
        catch { return; } // Cache failure must not interrupt message delivery.
        // Store the protobuf snapshot, not its mutable object tree or a pooled
        // Buffer's backing slab. Decode only when WhatsApp requests a retry.
        const payload = Uint8Array.from(encoded);
        entries.set(id, { payload, expires: timestamp + ttlMs });
        bytes += payload.byteLength;
        while (entries.size > maxEntries || bytes > maxBytes) {
            remove(entries.keys().next().value);
        }
    }
    async function getMessage(key) {
        const id = keyFor(key);
        const value = entries.get(id);
        if (!value || value.expires <= now()) { remove(id); return undefined; }
        return messageType.decode(value.payload);
    }
    return { remember, getMessage, clear: () => { entries.clear(); bytes = 0; } };
}

function createWhatsAppLogger(name, pino, log = console) {
    const lastLogged = new Map();
    return pino({
        level: 'warn',
        hooks: {
            logMethod(args) {
                // Baileys error objects can contain keys, message bodies and
                // binary nodes. Log categories only, never those raw objects.
                const text = typeof args.at(-1) === 'string' ? args.at(-1) : '';
                const category = /decrypt|cipher|mac/i.test(text) ? 'decryption'
                    : /retry|resend/i.test(text) ? 'retry'
                    : /session|pre.?key/i.test(text) ? 'session' : 'protocol';
                if (Date.now() - (lastLogged.get(category) || 0) < 30000) return;
                lastLogged.set(category, Date.now());
                log.warn(`[whatsapp:${name}] ${category} warning; private details omitted.`);
            },
        },
    });
}

function createWhatsAppConnection({ name, root, onState, onMessages, onEvent, env = process.env }, dependencies = {}) {
    const baileys = dependencies.baileys || require('@whiskeysockets/baileys');
    const log = dependencies.log || console;
    const schedule = dependencies.schedule || setTimeout;
    const cancel = dependencies.cancel || clearTimeout;
    const logger = dependencies.logger || createWhatsAppLogger(name, require('pino'), log);
    const retries = createRetryStore({ messageType: baileys.proto.Message });
    const terminal = new Set([
        baileys.DisconnectReason.loggedOut, baileys.DisconnectReason.connectionReplaced,
        baileys.DisconnectReason.badSession, baileys.DisconnectReason.multideviceMismatch,
        baileys.DisconnectReason.forbidden,
    ]);
    let socket = null, starting = null, timer = null, stopped = false, generation = 0, attempts = 0;
    let saves = Promise.resolve();
    let removeListeners = () => {};

    function clearRetry() { if (timer !== null) cancel(timer); timer = null; }
    function reconnect(reason) {
        if (stopped || timer !== null) return;
        const delay = reason === baileys.DisconnectReason.restartRequired ? 250
            : Math.min(300000, 1000 * 2 ** Math.min(attempts++, 9));
        log.warn(`[whatsapp:${name}] Connection closed (${Number(reason) || 'unknown'}); reconnecting in ${delay}ms.`);
        const retryGeneration = generation;
        const queued = schedule(() => {
            if (stopped || generation !== retryGeneration || timer !== queued) return;
            timer = null;
            start().catch(() => {});
        }, delay);
        timer = queued;
        timer?.unref?.();
    }

    function start() {
        if (starting) return starting;
        if (socket) return Promise.resolve(socket);
        stopped = false;
        clearRetry();
        const token = ++generation;
        const task = (async () => {
            await saves;
            const folder = await resolveAuthFolder(name, { root, env });
            const { state, saveCreds } = await baileys.useMultiFileAuthState(folder);
            if (stopped || token !== generation) return null;
            const sock = baileys.default({
                auth: state, logger, printQRInTerminal: false,
                // Let the primary phone remain active and receive notifications.
                markOnlineOnConnect: false,
                browser: baileys.Browsers.ubuntu('Chrome'),
                connectTimeoutMs: 60000,
                // Do not request the phone's full archive. Retain bootstrap,
                // recent and metadata sync for identity mapping and encryption.
                syncFullHistory: false,
                shouldSyncHistoryMessage: ({ syncType }) => syncType !== baileys.proto.HistorySync.HistorySyncType.FULL,
                generateHighQualityLinkPreview: false, linkPreviewImageThumbnailWidth: 192,
                getMessage: retries.getMessage,
                enableAutoSessionRecreation: true, enableRecentMessageCache: true,
            });
            socket = sock;
            const current = () => socket === sock && generation === token && !stopped;
            const save = () => {
                if (!current()) return;
                saves = saves.then(saveCreds).catch(() => {
                    log.error(`[whatsapp:${name}] Could not save session credentials; check persistent disk permissions.`);
                });
            };
            const messages = ({ messages, type }) => {
                if (!current()) return;
                for (const message of messages) retries.remember(message);
                if (messages.some(message => message.messageStubType === baileys.proto.WebMessageInfo.StubType.CIPHERTEXT)) {
                    logger.warn('Incoming message decryption failed; Baileys retry handling is enabled.');
                }
                if (onMessages) Promise.resolve(onMessages(sock, { messages, type })).catch(() => {
                    log.error(`[whatsapp:${name}] Incoming message handler failed; private details omitted.`);
                });
            };
            const update = value => {
                if (!current()) return;
                if (value.connection === 'close') {
                    removeListeners();
                    socket = null;
                    const reason = value.lastDisconnect?.error?.output?.statusCode;
                    onState({ socket: null, connection: 'close', qr: null });
                    if (terminal.has(reason)) {
                        stopped = true;
                        if (reason === baileys.DisconnectReason.loggedOut) retries.clear();
                        log.warn(`[whatsapp:${name}] Connection stopped (${reason}); check linked devices and other running bot instances before reconnecting.`);
                    } else reconnect(reason);
                } else {
                    if (value.connection === 'open') attempts = 0;
                    onState({ ...value, socket: sock });
                }
            };
            const report = (event, data) => {
                if (current() && onEvent) Promise.resolve(onEvent(event, data)).catch(() => {
                    log.error(`[whatsapp:${name}] Event recording failed; private details omitted.`);
                });
            };
            const receipts = updates => {
                for (const item of updates.slice(0, 100)) {
                    const status = ({ 0: 'failed', 2: 'sent', 3: 'delivered', 4: 'read', 5: 'read' })[item.update?.status];
                    if (status && item.key?.id) report('message.status', { messageId: item.key.id, status });
                }
            };
            const groups = updates => {
                for (const item of updates.slice(0, 100)) report('group.updated', { jid: item.id, subject: item.subject });
            };
            removeListeners = () => {
                sock.ev.off('creds.update', save);
                sock.ev.off('messages.upsert', messages);
                sock.ev.off('connection.update', update);
                sock.ev.off('messages.update', receipts);
                sock.ev.off('groups.update', groups);
                removeListeners = () => {};
            };
            sock.ev.on('creds.update', save);
            sock.ev.on('messages.upsert', messages);
            sock.ev.on('connection.update', update);
            if (onEvent) { sock.ev.on('messages.update', receipts); sock.ev.on('groups.update', groups); }
            // Retain original protobufs across socket reconnects for retry
            // receipts, including media and manually relayed link buttons.
            const send = sock.sendMessage.bind(sock);
            sock.sendMessage = async (...args) => {
                if (!current()) throw new Error('WhatsApp socket is no longer active');
                const sent = await send(...args);
                if (current()) retries.remember(sent);
                return sent;
            };
            const relay = sock.relayMessage.bind(sock);
            sock.relayMessage = async (jid, message, options = {}) => {
                if (!current()) throw new Error('WhatsApp socket is no longer active');
                const id = await relay(jid, message, options);
                if (current()) retries.remember({ key: { remoteJid: jid, id: options.messageId || id }, message });
                return id;
            };
            onState({ socket: sock, connection: 'connecting' });
            return sock;
        })().catch(error => {
            if (!stopped && token === generation) {
                log.error(`[whatsapp:${name}] Could not start connection; check session storage and server configuration.`);
                onState({ socket: null, connection: 'close', qr: null });
                reconnect();
            }
            throw error;
        }).finally(() => { if (starting === task) starting = null; });
        starting = task;
        return task;
    }

    async function disconnect() {
        stopped = true;
        generation++;
        clearRetry();
        retries.clear();
        const sock = socket;
        socket = null;
        removeListeners();
        onState({ socket: null, connection: 'close', qr: null });
        if (starting) await starting.catch(() => {});
        await saves;
        if (sock) await sock.logout();
    }

    async function pause() {
        stopped = true;
        generation++;
        clearRetry();
        const sock = socket;
        socket = null;
        removeListeners();
        onState({ socket: null, connection: 'close', qr: null });
        if (starting) await starting.catch(() => {});
        await saves;
        if (sock) await sock.end(new Error('Connection paused by administrator'));
    }

    return { start, disconnect, pause, isCurrent: sock => socket === sock && !stopped };
}

module.exports = { resolveAuthFolder, createRetryStore, createWhatsAppLogger, createWhatsAppConnection };
