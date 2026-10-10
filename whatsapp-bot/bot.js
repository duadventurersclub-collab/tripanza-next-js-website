const {
    proto,
    generateWAMessageFromContent,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const axios = require('axios');
const http = require('http');
const crypto = require('crypto');
const { renderDashboard, renderBotPage } = require('./frontend');
const { initializeWorkspace, isWorkspaceRequest, workspaceUnavailable } = require('./business/runtime');
const { createWhatsAppConnection } = require('./business/whatsappConnection');
const { safeRequestHandler, configureHttpServer } = require('./business/httpServer');
const { startRuntimeDiagnostics } = require('./business/runtimeDiagnostics');
const { createAccountManager } = require('./business/accounts');
const { loadTripanzaPdf, tripanzaPdfUrl } = require('./outboundDocument');
try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const memoryDiagnostics = startRuntimeDiagnostics();
let businessWorkspace = null;
let workspaceReady = Promise.resolve(null);

// WordPress Webhook URL
const WP_WEBHOOK_URL = 'https://tripanza.com/wp-json/whatsapp-ai/v1/server-reply/';
const WP_WEBHOOK_SECRET = process.env.WP_WEBHOOK_SECRET || '';
// Native-flow CTA buttons are not rendered by WhatsApp Web/Desktop and appear
// there as "This message couldn't load". Leave them opt-in for phone-only use.
const ENABLE_NATIVE_LINK_CTA = process.env.ENABLE_NATIVE_LINK_CTA === 'true';

// ==========================================
// 1. DUAL BOT STATE
// ==========================================
let qrNotifications = null;
let isConnectedNotifications = false;
let sockNotifications = null;

let qrCRM = null;
let isConnectedCRM = false;
let sockCRM = null;
const notificationsConnection = createWhatsAppConnection({
    name: 'notifications', root: __dirname,
    onEvent(event, data) { return businessWorkspace?.publishGatewayEvent('notifications', event, data); },
    async onMessages(_sock, { messages, type }) {
        if (type !== 'notify') return;
        for (const message of messages) await businessWorkspace?.handleGatewayIncoming('notifications', message);
    },
    onState({ socket, connection, qr }) {
        sockNotifications = socket;
        if (qr !== undefined) qrNotifications = qr;
        if (qr || connection === 'connecting' || connection === 'close') isConnectedNotifications = false;
        if (connection === 'open') {
            isConnectedNotifications = true;
            qrNotifications = null;
            console.log('✅ NOTIFICATIONS Bot Connected Successfully!');
        }
        if (connection === 'open' || connection === 'close') businessWorkspace?.publishGatewayEvent('notifications', 'connection', { status: connection === 'open' ? 'connected' : 'disconnected' }).catch(() => {});
    },
});
const crmConnection = createWhatsAppConnection({
    name: 'crm', root: __dirname, onMessages: handleCRMMessages,
    onEvent(event, data) { return businessWorkspace?.publishGatewayEvent('crm', event, data); },
    onState({ socket, connection, qr }) {
        sockCRM = socket;
        if (qr !== undefined) qrCRM = qr;
        if (qr || connection === 'connecting' || connection === 'close') isConnectedCRM = false;
        if (connection === 'open') {
            isConnectedCRM = true;
            qrCRM = null;
            console.log('✅ CRM Bot Connected Successfully!');
        }
        if (connection === 'open' || connection === 'close') businessWorkspace?.publishGatewayEvent('crm', 'connection', { status: connection === 'open' ? 'connected' : 'disconnected' }).catch(() => {});
    },
});
const crmSentSignatures = new Map();
const accountManager = createAccountManager({ root: __dirname,
    builtins: {
        crm: { connection: crmConnection, socket: () => sockCRM, async status() { return { status: isConnectedCRM ? 'connected' : sockCRM ? 'connecting' : 'disconnected', qr: qrCRM ? await QRCode.toDataURL(qrCRM) : null }; } },
        notifications: { connection: notificationsConnection, socket: () => sockNotifications, async status() { return { status: isConnectedNotifications ? 'connected' : sockNotifications ? 'connecting' : 'disconnected', qr: qrNotifications ? await QRCode.toDataURL(qrNotifications) : null }; } },
    },
    async onIncoming(id, message) { await businessWorkspace?.handleGatewayIncoming(id, message); },
    async onEvent(id, event, data) { await businessWorkspace?.publishGatewayEvent(id, event, data); },
});
setInterval(() => {
    const now = Date.now();
    for (const [key, expires] of crmSentSignatures) if (expires <= now) crmSentSignatures.delete(key);
}, 300000).unref();

function crmMessageText(content) {
    return String(content?.text || content?.caption || '').trim();
}

function crmSignature(jid, text) {
    return `${jid}|${String(text).trim()}`;
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function extractFirstHttpUrl(text) {
    const match = String(text || '').match(/https?:\/\/[^\s<>'"`]+/i);
    return match ? match[0].replace(/[),.!?]+$/g, '') : '';
}

function linkCtaLabel(url) {
    const value = String(url || '').toLowerCase();
    if (/generate_pdf=1|\.pdf(?:\?|$)/.test(value)) return 'Open itinerary';
    if (/tour-reels|reel|video/.test(value)) return 'Watch reels';
    if (/booking|checkout|cart/.test(value)) return 'Book this trip';
    if (/wa\.me|whatsapp\.com/.test(value)) return 'Open WhatsApp';
    if (/tripanza\.com/.test(value)) return 'Explore Tripanza';
    return 'Open link';
}

function withAutomaticLinkButton(content) {
    // Keep the original URL in the text so it works in every WhatsApp client.
    if (!content || typeof content !== 'object') return content;
    if (content.__plain === true) {
        const { __plain, ...plainContent } = content;
        return plainContent;
    }
    if (!ENABLE_NATIVE_LINK_CTA || !content.text || content.buttons || content.templateButtons || content.__linkCta) return content;
    const url = extractFirstHttpUrl(content.text);
    if (!url) return content;
    return {
        ...content,
        __linkCta: { url, label: linkCtaLabel(url) }
    };
}

function createLinkCtaContent(text, url, label = '') {
    const safeUrl = extractFirstHttpUrl(url);
    if (!safeUrl) return { text: String(text || '') };
    return {
        text: String(text || ''),
        __linkCta: { url: safeUrl, label: String(label || linkCtaLabel(safeUrl)).slice(0, 20) }
    };
}

async function sendNativeLinkCta(sock, jid, content, cta) {
    const bodyText = String(content?.text || '').trim();
    const url = extractFirstHttpUrl(cta?.url);
    if (!bodyText || !url) throw new Error('CTA needs a valid message and HTTPS link');
    if (!proto?.Message?.InteractiveMessage || typeof generateWAMessageFromContent !== 'function') {
        throw new Error('Native CTA is unavailable in this Baileys version');
    }

    const interactiveMessage = proto.Message.InteractiveMessage.create({
        body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }),
        footer: proto.Message.InteractiveMessage.Footer.create({ text: content.footer || 'Tripanza' }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: [{
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: cta.label || linkCtaLabel(url),
                    url,
                    merchant_url: url
                })
            }]
        })
    });
    const message = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: { interactiveMessage }
        }
    }, { userJid: sock.user?.id });
    await sock.relayMessage(jid, message.message, { messageId: message.key.id });
    return message;
}

async function sendCRMMessage(sock, jid, content, recordInWorkspace = true) {
    content = withAutomaticLinkButton(content);
    const cta = content?.__linkCta;
    if (cta) {
        const { __linkCta, ...nativeContent } = content;
        const text = crmMessageText(nativeContent);
        const signature = text ? crmSignature(jid, text) : '';
        if (signature) crmSentSignatures.set(signature, Date.now() + 120000);
        try {
            const sent = await sendNativeLinkCta(sock, jid, nativeContent, cta);
            if (recordInWorkspace && businessWorkspace) await businessWorkspace.recordOutgoing(jid, nativeContent, sent).catch(error => console.error('[workspace] Could not record reply:', error.message));
            return sent;
        } catch (error) {
            if (signature) crmSentSignatures.delete(signature);
            throw error;
        }
    }
    const text = crmMessageText(content);
    const signature = text ? crmSignature(jid, text) : '';
    if (signature) crmSentSignatures.set(signature, Date.now() + 120000);
    try {
        const sent = await sock.sendMessage(jid, content);
        if (recordInWorkspace && businessWorkspace) await businessWorkspace.recordOutgoing(jid, content, sent).catch(error => console.error('[workspace] Could not record reply:', error.message));
        return sent;
    } catch (error) {
        if (signature) crmSentSignatures.delete(signature);
        throw error;
    }
}

async function sendTextWithLinkCta(sock, jid, text, isCRM = false) {
    const original = { text: String(text || '') };
    const enhanced = withAutomaticLinkButton(original);
    try {
        return isCRM
            ? await sendCRMMessage(sock, jid, original)
            : (enhanced.__linkCta
                ? sendNativeLinkCta(sock, jid, { text: original.text }, enhanced.__linkCta)
                : sock.sendMessage(jid, enhanced));
    } catch (error) {
        // URL stays clickable in plain text even on WhatsApp clients that reject
        // the richer template button payload.
        if (enhanced.__linkCta) {
            console.warn(`⚠️ Link CTA was rejected; sending plain clickable link: ${error.message}`);
            return isCRM
                ? await sendCRMMessage(sock, jid, { __plain: true, text: original.text })
                : await sock.sendMessage(jid, original);
        }
        throw error;
    }
}

async function sendCRMMessageWithRetry(sock, jid, content, label = 'media') {
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            return await sendCRMMessage(sock, jid, content);
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ ${label} send attempt ${attempt}/2 failed: ${error.message}`);
            if (attempt < 2) await wait(1500 * attempt);
        }
    }
    throw lastError;
}

async function sendMediaFallback(sock, jid, label, url) {
    if (!url) return;
    try {
        await sendCRMMessage(sock, jid, { __plain: true, text: `I could not attach the ${label} right now. You can still open it here: ${url}` });
    } catch (error) {
        console.error(`❌ Could not send ${label} fallback:`, error.message);
    }
}

function mediaVideoMimeType(url) {
    return /\.webm(?:\?|$)/i.test(String(url)) ? 'video/webm' : 'video/mp4';
}

function phoneFromJid(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

async function resolveCRMPhoneJid(sock, jid) {
    const remoteJid = String(jid || '');
    if (!remoteJid.endsWith('@lid')) return remoteJid;
    try {
        // WhatsApp increasingly delivers private LID identifiers instead of
        // phone JIDs. Baileys maintains the authenticated LID → phone mapping.
        return await sock.signalRepository?.lidMapping?.getPNForLID(remoteJid) || '';
    } catch (error) {
        console.warn(`⚠️ Could not resolve WhatsApp LID ${remoteJid}: ${error.message}`);
        return '';
    }
}

// ==========================================
// 2. NOTIFICATIONS BOT (Phone 1)
// ==========================================
async function startNotificationsBot() {
    // This socket keeps retry originals but never responds to incoming messages.
    return notificationsConnection.start();
}

// ==========================================
// 3. CRM BOT / KANIKA (Phone 2)
// ==========================================
async function startCRMBot() {
    return crmConnection.start();
}

// Listen for Incoming Messages (Only CRM does this).
async function handleCRMMessages(sock, { messages, type }) {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!crmConnection.isCurrent(sock)) return;
            if (!msg.message || !msg.key?.remoteJid || msg.key.remoteJid.includes('@g.us')) continue;

            const senderJid = msg.key.remoteJid;
            const senderPhoneJid = await resolveCRMPhoneJid(sock, senderJid);
            const senderPhone = phoneFromJid(senderPhoneJid);

            if (businessWorkspace) {
                try {
                    const workspaceMessage = { ...msg, key: { ...msg.key, senderPn: senderPhoneJid || msg.key.senderPn } };
                    if (await businessWorkspace.handleIncoming(workspaceMessage)) continue;
                } catch (error) {
                    console.error('[workspace] Could not handle CRM message:', error.message);
                    // Do not send a second automated reply after a workspace error.
                    continue;
                }
            }

            const userText = msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.imageMessage?.caption || '';
            if (!userText.trim()) continue;

            // Never save a WhatsApp LID as a customer phone number. Waiting for
            // a mapping is safer than creating an unusable CRM lead.
            if (!senderPhone) {
                console.warn(`⚠️ Ignoring CRM webhook for unresolved contact ${senderJid}; no phone mapping is available yet.`);
                continue;
            }

            // Capture genuine replies sent manually from the linked CRM phone.
            // Messages sent by this process are suppressed to avoid duplicate logs.
            if (msg.key.fromMe) {
                const signature = crmSignature(senderJid, userText);
                const expiry = crmSentSignatures.get(signature) || 0;
                if (expiry > Date.now()) {
                    crmSentSignatures.delete(signature);
                    continue;
                }
                try {
                    await axios.post(WP_WEBHOOK_URL, {
                        phone: senderPhone,
                        sender: senderPhone,
                        message: userText,
                        event_type: 'human_reply'
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            ...(WP_WEBHOOK_SECRET ? { 'X-Tripanza-Webhook-Secret': WP_WEBHOOK_SECRET } : {})
                        },
                        timeout: 15000
                    });
                    console.log(`🧑 Human CRM reply recorded for [${senderPhone}]`);
                } catch (error) {
                    console.error(`❌ Could not record human CRM reply for [${senderPhone}]:`, error.message);
                }
                continue;
            }

            console.log(`\n📩 Incoming to CRM from [${senderPhone}]: ${userText}`);

            try {
                const replyState = await businessWorkspace?.getCrmReplyState();
                if (replyState && !replyState.allowed) continue;
                await sock.sendPresenceUpdate('composing', senderJid);
                const response = await axios.post(WP_WEBHOOK_URL, {
                    phone: senderPhone,
                    message: userText,
                    sender: senderPhone
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(WP_WEBHOOK_SECRET ? { 'X-Tripanza-Webhook-Secret': WP_WEBHOOK_SECRET } : {})
                    },
                    timeout: 45000
                });
                await sock.sendPresenceUpdate('paused', senderJid);

                const data = response.data;
                const currentReplyState = await businessWorkspace?.getCrmReplyState();
                if (currentReplyState && (!currentReplyState.allowed || currentReplyState.revision !== replyState?.revision)) continue;

                // 1. Send text reply (with optional interactive buttons)
                if (data.reply) {
                    try {
                        if (data.list_menu && data.list_menu.sections) {
                            // Send List Message
                            const listMessage = {
                                text: data.reply,
                                footer: data.list_menu.footer || 'Tripanza',
                                title: data.list_menu.title || '',
                                buttonText: data.list_menu.buttonText || 'View Options',
                                sections: data.list_menu.sections
                            };
                            await sendCRMMessage(sock, senderJid, listMessage);
                            console.log(`📋 CRM Sent List Menu to [${senderPhone}]`);
                        } else if (data.cta_url && data.cta_url.url && data.cta_url.displayText) {
                            // Keep links readable on Web/Desktop by default. Set
                            // ENABLE_NATIVE_LINK_CTA=true only for phone-only CTA UI.
                            const templateMessage = ENABLE_NATIVE_LINK_CTA
                                ? createLinkCtaContent(data.reply, data.cta_url.url, data.cta_url.displayText)
                                : { text: `${data.reply}\n${data.cta_url.url}`.trim() };
                            await sendCRMMessage(sock, senderJid, templateMessage);
                            console.log(`🔗 CRM Sent URL CTA to [${senderPhone}]`);
                        } else if (data.buttons && Array.isArray(data.buttons) && data.buttons.length > 0) {
                            // Send Quick Reply Buttons (max 3)
                            const buttons = data.buttons.slice(0, 3).map((btn, idx) => ({
                                buttonId: `btn_${idx}`, 
                                buttonText: { displayText: btn }, 
                                type: 1
                            }));
                            const buttonMessage = {
                                text: data.reply,
                                buttons: buttons,
                                headerType: 1
                            };
                            await sendCRMMessage(sock, senderJid, buttonMessage);
                            console.log(`🔘 CRM Sent Quick Reply Buttons to [${senderPhone}]`);
                        } else {
                            // Send standard text
                            await sendCRMMessage(sock, senderJid, { text: data.reply });
                            console.log(`💬 CRM Sent Text Reply to [${senderPhone}]`);
                        }
                    } catch (btnErr) {
                        console.error(`⚠️ Failed to send interactive message, falling back to text: ${btnErr.message}`);
                        await sendCRMMessage(sock, senderJid, { __plain: true, text: data.reply });
                    }
                }

                // 2. Send PDF document as a real WhatsApp document. If the remote
                // server rejects the fetch, preserve access with a clickable fallback.
                if (data.pdf_url) {
                    try {
                        await sendCRMMessageWithRetry(sock, senderJid, {
                            document: { url: data.pdf_url },
                            mimetype: 'application/pdf',
                            fileName: data.pdf_filename || 'Tripanza_Itinerary.pdf',
                            caption: data.pdf_caption || '📄 Here is the detailed itinerary for you!'
                        }, 'PDF');
                        console.log(`📄 CRM Sent PDF to [${senderPhone}]`);
                    } catch (mediaError) {
                        console.error(`❌ PDF dispatch failed for [${senderPhone}]:`, mediaError.message);
                        await sendMediaFallback(sock, senderJid, 'itinerary PDF', data.pdf_url);
                    }
                }

                // 3. Send every reel saved against this st_tours inventory trip.
                // Keep each video independent so one broken file never blocks the rest.
                const reelUrls = Array.isArray(data.video_urls)
                    ? data.video_urls
                    : (data.video_url ? [data.video_url] : []);
                if (reelUrls.length) {
                    let sentReels = 0;
                    for (let i = 0; i < reelUrls.length; i++) {
                        const reelUrl = reelUrls[i];
                        if (typeof reelUrl !== 'string' || !/^https?:\/\//i.test(reelUrl)) continue;
                        try {
                            await sendCRMMessageWithRetry(sock, senderJid, {
                                video: { url: reelUrl },
                                mimetype: mediaVideoMimeType(reelUrl),
                                caption: i === 0
                                    ? (data.video_caption || `🎥 Real trip moments · ${reelUrls.length} reel${reelUrls.length === 1 ? '' : 's'}`)
                                    : `🎥 Trip reel ${i + 1} of ${reelUrls.length}`
                            }, `reel ${i + 1}`);
                            sentReels++;
                        } catch (mediaError) {
                            console.error(`❌ Reel ${i + 1} dispatch failed for [${senderPhone}]:`, mediaError.message);
                            await sendMediaFallback(sock, senderJid, `trip reel ${i + 1}`, reelUrl);
                        }
                        if (i < reelUrls.length - 1) await wait(900);
                    }
                    console.log(`🎥 CRM Sent ${sentReels}/${reelUrls.length} reels to [${senderPhone}]`);
                }

                // 4. Send single image (tour featured image)
                if (data.image_url) {
                    try {
                        await sendCRMMessageWithRetry(sock, senderJid, {
                            image: { url: data.image_url },
                            caption: data.image_caption || ''
                        }, 'trip image');
                        console.log(`🖼️ CRM Sent Image to [${senderPhone}]`);
                    } catch (mediaError) {
                        console.error(`❌ Trip image dispatch failed for [${senderPhone}]:`, mediaError.message);
                        await sendMediaFallback(sock, senderJid, 'trip image', data.image_url);
                    }
                }

                // 5. Send all accommodation photos grouped by property. The legacy
                // image_urls payload is still understood for previously cached replies.
                const accommodationGroups = Array.isArray(data.accommodation_groups)
                    ? data.accommodation_groups
                    : (Array.isArray(data.image_urls) && data.image_urls.length ? [{
                        hotel_name: data.hotel_name || 'Your stay', image_urls: data.image_urls
                    }] : []);
                if (accommodationGroups.length) {
                    let sentPhotos = 0;
                    let totalPhotos = 0;
                    for (const group of accommodationGroups) {
                        if (Array.isArray(group?.image_urls)) totalPhotos += group.image_urls.length;
                    }
                    for (const group of accommodationGroups) {
                        const photos = Array.isArray(group?.image_urls) ? group.image_urls : [];
                        const property = String(group?.hotel_name || 'Your stay').trim();
                        for (let i = 0; i < photos.length; i++) {
                            const imageUrl = photos[i];
                            if (typeof imageUrl !== 'string' || !/^https?:\/\//i.test(imageUrl)) continue;
                            try {
                                await sendCRMMessageWithRetry(sock, senderJid, {
                                    image: { url: imageUrl },
                                    caption: i === 0 ? `🏨 ${property} · ${photos.length} photo${photos.length === 1 ? '' : 's'}` : ''
                                }, `${property} photo ${i + 1}`);
                                sentPhotos++;
                            } catch (mediaError) {
                                console.error(`❌ ${property} photo ${i + 1} failed for [${senderPhone}]:`, mediaError.message);
                            }
                            if (i < photos.length - 1) await wait(650);
                        }
                    }
                    console.log(`🏨 CRM Sent ${sentPhotos}/${totalPhotos} accommodation photos to [${senderPhone}]`);
                }
            } catch (err) {
                console.error(`❌ CRM Error responding to ${senderPhone}:`, err.message);
            }
        }
}

// ==========================================
// 4. WEB SERVER (Dashboard & API)
// ==========================================
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || '';

function safeKeyMatch(provided) {
    if (!API_KEY || typeof provided !== 'string') return false;
    const expected = Buffer.from(API_KEY);
    const received = Buffer.from(provided);
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

const server = http.createServer(safeRequestHandler(async (req, res) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && req.url.split('?')[0] === '/healthz') {
        const ready = process.env.BUSINESS_WORKSPACE_ENABLED === 'false' || !!businessWorkspace;
        res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(!ready ? { 'Retry-After': '10' } : {}) });
        return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: ready ? 'ok' : 'starting', workspace: ready ? 'ready' : 'unavailable' }));
    }
    // ------------------------------------------
    // A) OUTBOUND API ENDPOINT (CRM follow-ups use the CRM number)
    // ------------------------------------------
    if (req.method === 'POST' && req.url === '/api/send') {
        let body = '';
        let tooLarge = false;
        let bodyBytes = 0;
        req.on('data', chunk => {
            if (tooLarge) return;
            bodyBytes += Buffer.byteLength(chunk);
            if (bodyBytes > 65536) { tooLarge = true; body = ''; return; }
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                if (tooLarge) {
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: 'Request body too large' }));
                }
                const data = JSON.parse(body);
                if (!API_KEY) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: 'Outbound API key is not configured' }));
                }
                if (!safeKeyMatch(data.api_key)) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: 'Invalid API Key' }));
                }

                const useCRM = data.bot === 'crm';
                const targetSocket = useCRM ? sockCRM : sockNotifications;
                const targetConnected = useCRM ? isConnectedCRM : isConnectedNotifications;
                const botName = useCRM ? 'CRM' : 'Notifications';
                if (!targetSocket || !targetConnected) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: `${botName} Bot is not connected yet` }));
                }

                let phone = String(data.phone).replace(/\D/g, '');
                phone = phone.replace(/^0+/, '');
                if (phone.length === 10) phone = '91' + phone;

                if (phone.length < 11 || phone.length > 15) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: 'Invalid phone number' }));
                }
                const message = typeof data.message === 'string' ? data.message.trim() : '';
                if (!message || message.length > 4000) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: 'Message must contain 1 to 4000 characters' }));
                }
                if (data.document_url) {
                    try { tripanzaPdfUrl(data.document_url); }
                    catch {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: false, error: 'Invalid itinerary PDF URL' }));
                    }
                }

                const jid = `${phone}@s.whatsapp.net`;
                if (data.document_url) {
                    const pdf = await loadTripanzaPdf(data.document_url);
                    const fileName = typeof data.document_name === 'string' && /^[a-zA-Z0-9_-]{1,80}\.pdf$/.test(data.document_name)
                        ? data.document_name : 'Tripanza_Itinerary.pdf';
                    await targetSocket.sendMessage(jid, { document: pdf, mimetype: 'application/pdf', fileName, caption: message });
                } else {
                    await sendTextWithLinkCta(targetSocket, jid, message, useCRM);
                }
                console.log(`📤 Outbound ${botName} message sent to [${phone}]`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Message sent' }));
            } catch (err) {
                console.error('API Send Error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }


    // ------------------------------------------
    // Business workspace is additive; the original outbound API stays above.
    if (isWorkspaceRequest(req.url)) {
        const workspace = businessWorkspace;
        if (workspace) return workspace.handleRequest(req, res);
        return workspaceUnavailable(res);
    }

    // B) NOTIFICATIONS QR PAGE
    // ------------------------------------------
    if (req.method === 'GET' && req.url === '/qr-notifications') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        if (isConnectedNotifications) {
            return res.end(renderBotPage(false, 'connected'));
        } else if (qrNotifications) {
            const qrImageDataURL = await QRCode.toDataURL(qrNotifications, { scale: 8 });
            return res.end(renderBotPage(false, 'qr', qrImageDataURL));
        } else {
            return res.end(renderBotPage(false, 'starting'));
        }
    }

    // ------------------------------------------
    // C) CRM QR PAGE
    // ------------------------------------------
    if (req.method === 'GET' && req.url === '/qr-crm') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        if (isConnectedCRM) {
            return res.end(renderBotPage(true, 'connected'));
        } else if (qrCRM) {
            const qrImageDataURL = await QRCode.toDataURL(qrCRM, { scale: 8 });
            return res.end(renderBotPage(true, 'qr', qrImageDataURL));
        } else {
            return res.end(renderBotPage(true, 'starting'));
        }
    }

    // ------------------------------------------
    // D) MAIN DASHBOARD
    // ------------------------------------------
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(renderDashboard(isConnectedNotifications, isConnectedCRM));
        return;
    }

    // 404 for other routes
    res.writeHead(404);
    res.end('Not Found');
}));
configureHttpServer(server);

// ==========================================
// 5. START SERVER & BOTS
// ==========================================
workspaceReady = initializeWorkspace(server, {
    async status() {
        return {
            status: isConnectedCRM ? 'connected' : qrCRM || sockCRM ? 'connecting' : 'disconnected',
            qr: qrCRM ? await QRCode.toDataURL(qrCRM, { scale: 8 }) : null,
        };
    },
    async send(jid, content, options) {
        if (!sockCRM || !isConnectedCRM) throw new Error('CRM Bot is not connected yet');
        if (options) {
            const text = crmMessageText(content);
            if (text) crmSentSignatures.set(crmSignature(jid, text), Date.now() + 120000);
            return sockCRM.sendMessage(jid, content, options);
        }
        return sendCRMMessage(sockCRM, jid, content, false);
    },
    async download(msg) {
        if (!sockCRM) return null;
        return downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sockCRM.updateMediaMessage });
    },
    async connect() {
        await startCRMBot();
    },
    async disconnect() {
        await crmConnection.disconnect();
    },
    accountStatus: id => accountManager.status(id),
    accountAction: (id, action) => accountManager.action(id, action),
    accountSend: (id, jid, content) => accountManager.send(id, jid, content),
    groupAction: (id, action, data) => accountManager.groups(id, action, data),
}).then(workspace => {
    businessWorkspace = workspace;
    memoryDiagnostics.report('workspace-ready');
    return workspace;
}).catch(error => {
    console.error('[workspace] Setup required:', error.message);
    return null;
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`👉 Open your Render URL to see the Dashboard!`);

    // Start both bots concurrently
    startNotificationsBot().catch(() => {}); // The connection manager logs and backs off.
    startCRMBot().catch(() => {});

    // KEEP-ALIVE PINGER
    const SELF_URL = process.env.RENDER_EXTERNAL_URL;
    if (SELF_URL) {
        setInterval(() => {
            axios.get(new URL('/healthz', SELF_URL).href, { timeout: 10000 }).catch(() => { });
        }, 10 * 60 * 1000); // every 10 mins
        console.log(`🏓 Keep-alive pinger configured for dual-bot.`);
    }
});
