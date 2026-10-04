import makeWASocket, { DisconnectReason, generateWAMessageFromContent, proto, useMultiFileAuthState as loadMultiFileAuthState } from "@whiskeysockets/baileys";
import pino from "pino";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const digits = value => String(value || "").replace(/\D/g, "");
const firstUrl = value => String(value || "").match(/https?:\/\/[^\s<>'"`]+/i)?.[0]?.replace(/[),.!?]+$/g, "") || "";
const linkLabel = url => /generate_pdf=1|\.pdf(?:\?|$)/i.test(url) ? "Open itinerary" : /reel|video/i.test(url) ? "Watch reels" : /booking|checkout|cart/i.test(url) ? "Book this trip" : "Open link";

export function normalizeWhatsAppPhone(value) {
  let phone = digits(value).replace(/^0+/, "");
  if (phone.length === 10) phone = `91${phone}`;
  return /^[1-9][0-9]{10,14}$/.test(phone) ? phone : "";
}

async function sendWebhook(url, secret, payload, timeout) {
  const response = await fetch(url, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(timeout),
    headers: { "Content-Type": "application/json", "X-Tripanza-Webhook-Secret": secret },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`CRM webhook returned ${response.status}`);
  return response.json();
}

function messageText(message) {
  return message?.conversation || message?.extendedTextMessage?.text || message?.imageMessage?.caption || "";
}

async function phoneJid(socket, jid) {
  if (!jid?.endsWith("@lid")) return jid || "";
  try { return await socket.signalRepository?.lidMapping?.getPNForLID(jid) || ""; }
  catch { return ""; }
}

async function sendNativeLink(socket, jid, content, label, url) {
  if (!proto?.Message?.InteractiveMessage || !generateWAMessageFromContent) throw new Error("Native CTA unavailable");
  const interactive = proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({ text: content }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: "Tripanza" }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons: [{
      name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: String(label || linkLabel(url)).slice(0, 20), url, merchant_url: url }),
    }] }),
  });
  const message = generateWAMessageFromContent(jid, { viewOnceMessage: { message: { interactiveMessage: interactive } } }, { userJid: socket.user?.id });
  return socket.relayMessage(jid, message.message, { messageId: message.key.id });
}

async function sendText(socket, jid, text, nativeCta = false, label = "", remember = null) {
  const value = String(text || "").trim();
  remember?.(jid, value);
  const url = nativeCta ? firstUrl(value) : "";
  if (url) {
    try { return await sendNativeLink(socket, jid, value, label, url); }
    catch (error) { console.warn("WhatsApp CTA fallback:", error.message); }
  }
  return socket.sendMessage(jid, { text: value });
}

async function sendMedia(socket, jid, content, fallbackUrl, label, remember = null) {
  if (content.caption) remember?.(jid, content.caption);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try { return await socket.sendMessage(jid, content); }
    catch (error) {
      console.warn(`WhatsApp ${label} send ${attempt}/2 failed:`, error.message);
      if (attempt < 2) await pause(1500);
    }
  }
  if (fallbackUrl) await sendText(socket, jid, `I could not attach the ${label} right now. You can open it here: ${fallbackUrl}`, false, "", remember);
}

export function createWhatsAppRuntime({ authDir, webhookUrl, webhookSecret, nativeLinkCta = false }) {
  const bots = {
    notifications: { socket: null, connected: false, qr: "", state: "starting", retry: null, attempts: 0 },
    crm: { socket: null, connected: false, qr: "", state: "starting", retry: null, attempts: 0 },
  };
  const sent = new Map();
  const seen = new Map();
  const queues = new Map();
  let stopped = false;
  const remember = (jid, text) => { if (text) sent.set(`${jid}|${String(text).trim()}`, Date.now() + 120_000); };
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, expiry] of sent) if (expiry < now) sent.delete(key);
    for (const [key, expiry] of seen) if (expiry < now) seen.delete(key);
  }, 300_000);
  cleanup.unref();

  function status() {
    return Object.fromEntries(Object.entries(bots).map(([name, bot]) => [name, { connected: bot.connected, qr_available: !!bot.qr, state: bot.state }]));
  }

  async function send(kind, phoneInput, messageInput) {
    if (!Object.hasOwn(bots, kind)) throw new Error("Invalid WhatsApp bot");
    const phone = normalizeWhatsAppPhone(phoneInput);
    const message = typeof messageInput === "string" ? messageInput.trim() : "";
    if (!phone) throw new Error("Invalid phone number");
    if (!message || message.length > 4000) throw new Error("Message must contain 1 to 4000 characters");
    const bot = bots[kind];
    if (!bot.connected || !bot.socket) throw new Error(`${kind} bot is not connected`);
    const jid = `${phone}@s.whatsapp.net`;
    if (kind === "crm") remember(jid, message);
    try { await sendText(bot.socket, jid, message, nativeLinkCta); }
    catch (error) { sent.delete(`${jid}|${message}`); throw error; }
    return { success: true, message: "Message sent" };
  }

  async function sendReply(socket, jid, data) {
    if (typeof data?.reply === "string" && data.reply.trim()) {
      const text = data.reply.trim();
      try {
        if (data.list_menu?.sections) { remember(jid, text); await socket.sendMessage(jid, { text, footer: data.list_menu.footer || "Tripanza", title: data.list_menu.title || "", buttonText: data.list_menu.buttonText || "View Options", sections: data.list_menu.sections }); }
        else if (data.cta_url?.url) {
          const url = firstUrl(data.cta_url.url);
          const withUrl = url && !text.includes(url) ? `${text}\n${url}` : text;
          await sendText(socket, jid, withUrl, nativeLinkCta, data.cta_url.displayText, remember);
        } else if (Array.isArray(data.buttons) && data.buttons.length) { remember(jid, text); await socket.sendMessage(jid, { text, buttons: data.buttons.slice(0, 3).map((label, index) => ({ buttonId: `btn_${index}`, buttonText: { displayText: String(label) }, type: 1 })), headerType: 1 }); }
        else await sendText(socket, jid, text, nativeLinkCta, "", remember);
      } catch (error) {
        console.warn("WhatsApp interactive reply fallback:", error.message);
        await sendText(socket, jid, data.cta_url?.url ? `${text}\n${data.cta_url.url}` : text, false, "", remember);
      }
    }
    if (data?.pdf_url) await sendMedia(socket, jid, { document: { url: data.pdf_url }, mimetype: "application/pdf", fileName: data.pdf_filename || "Tripanza_Itinerary.pdf", caption: data.pdf_caption || "Here is your itinerary." }, data.pdf_url, "itinerary PDF", remember);
    const reels = Array.isArray(data?.video_urls) ? data.video_urls : data?.video_url ? [data.video_url] : [];
    for (let index = 0; index < reels.length; index++) {
      const url = reels[index];
      if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue;
      await sendMedia(socket, jid, { video: { url }, mimetype: /\.webm(?:\?|$)/i.test(url) ? "video/webm" : "video/mp4", caption: index === 0 ? data.video_caption || `Real trip moments · ${reels.length} reels` : `Trip reel ${index + 1} of ${reels.length}` }, url, `trip reel ${index + 1}`, remember);
      if (index < reels.length - 1) await pause(900);
    }
    if (data?.image_url) await sendMedia(socket, jid, { image: { url: data.image_url }, caption: data.image_caption || "" }, data.image_url, "trip image", remember);
    const groups = Array.isArray(data?.accommodation_groups) ? data.accommodation_groups : Array.isArray(data?.image_urls) && data.image_urls.length ? [{ hotel_name: data.hotel_name || "Your stay", image_urls: data.image_urls }] : [];
    for (const group of groups) {
      const photos = Array.isArray(group?.image_urls) ? group.image_urls : [];
      for (let index = 0; index < photos.length; index++) {
        const url = photos[index];
        if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue;
        await sendMedia(socket, jid, { image: { url }, caption: index === 0 ? `${group.hotel_name || "Your stay"} · ${photos.length} photos` : "" }, "", "accommodation photo", remember);
        if (index < photos.length - 1) await pause(650);
      }
    }
  }

  async function processMessage(socket, message) {
    const jid = message?.key?.remoteJid;
    if (!jid || jid.endsWith("@g.us") || !message.message) return;
    const text = messageText(message.message).trim();
    if (!text) return;
    const id = `${jid}|${message.key?.id || ""}|${message.key?.fromMe ? 1 : 0}`;
    if (message.key?.id && seen.has(id)) return;
    if (message.key?.id) seen.set(id, Date.now() + 600_000);
    const mapped = await phoneJid(socket, jid);
    const phone = normalizeWhatsAppPhone(String(mapped).split("@")[0].split(":")[0]);
    if (!phone) { console.warn("WhatsApp CRM ignored a message with no phone mapping"); return; }
    if (message.key?.fromMe) {
      const signature = `${jid}|${text}`;
      if ((sent.get(signature) || 0) > Date.now()) { sent.delete(signature); return; }
      await sendWebhook(webhookUrl, webhookSecret, { phone, sender: phone, message: text, event_type: "human_reply" }, 15_000);
      return;
    }
    await socket.sendPresenceUpdate("composing", jid);
    try {
      const reply = await sendWebhook(webhookUrl, webhookSecret, { phone, sender: phone, message: text }, 45_000);
      await sendReply(socket, jid, reply);
    } finally { await socket.sendPresenceUpdate("paused", jid).catch(() => {}); }
  }

  async function connect(kind) {
    if (stopped) return;
    const bot = bots[kind];
    bot.state = "connecting";
    const { state, saveCreds } = await loadMultiFileAuthState(join(authDir, `auth_${kind}`));
    const socket = makeWASocket({ auth: state, logger: pino({ level: "silent" }), generateHighQualityLinkPreview: true, linkPreviewImageThumbnailWidth: 512, browser: [kind === "crm" ? "Tripanza Kanika AI" : "Tripanza Notifications", "Chrome", "1.0.0"] });
    bot.socket = socket;
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", update => {
      if (stopped || bot.socket !== socket) return;
      if (update.qr) { bot.qr = update.qr; bot.connected = false; bot.state = "scan_qr"; }
      if (update.connection === "open") { bot.connected = true; bot.qr = ""; bot.state = "connected"; bot.attempts = 0; }
      if (update.connection === "close") {
        bot.connected = false; bot.qr = "";
        const loggedOut = update.lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
        bot.state = loggedOut ? "logged_out" : "reconnecting";
        bot.socket = null;
        if (!loggedOut) {
          const delay = Math.min(30_000, 1000 * 2 ** Math.min(bot.attempts++, 5));
          bot.retry = setTimeout(() => { void connect(kind).catch(error => console.error(`WhatsApp ${kind} reconnect:`, error)); }, delay);
        }
      }
    });
    if (kind === "crm") socket.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify" || stopped || bot.socket !== socket) return;
      for (const message of messages) {
        const jid = message?.key?.remoteJid || "";
        const prior = queues.get(jid) || Promise.resolve();
        const next = prior.catch(() => {}).then(() => processMessage(socket, message)).catch(error => console.error("WhatsApp CRM message:", error.message));
        queues.set(jid, next);
        void next.finally(() => { if (queues.get(jid) === next) queues.delete(jid); });
      }
    });
  }

  async function start() {
    await mkdir(authDir, { recursive: true, mode: 0o700 });
    await Promise.allSettled(Object.keys(bots).map(async kind => {
      try { await connect(kind); }
      catch (error) { bots[kind].state = "error"; console.error(`WhatsApp ${kind} startup:`, error); }
    }));
  }

  function stop() {
    stopped = true;
    clearInterval(cleanup);
    for (const bot of Object.values(bots)) {
      if (bot.retry) clearTimeout(bot.retry);
      bot.connected = false;
      bot.state = "stopped";
      try { bot.socket?.end(new Error("Server stopping")); } catch { /* Existing session credentials remain on disk. */ }
    }
  }

  return { start, stop, status, send, qr: kind => Object.hasOwn(bots, kind) ? bots[kind].qr : "" };
}
