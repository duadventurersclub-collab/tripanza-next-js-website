import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, desc, lte, sql, inArray } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { config } from "../config.js";
import { getGatewayAdapter, sendWaMessage } from "./waGateway.js";
import { publicUrl, publicRequest } from "./automationTransport.js";
import type { proto } from "@whiskeysockets/baileys";
import { crmAutoRepliesAllowed } from "./crmReplyControls.js";

type Data = Record<string, any>;
export interface MessagePayload {
  text: string; media?: { kind: "image" | "video" | "document"; url: string; fileName?: string };
  buttons?: { kind: "url" | "reply"; label: string; value: string }[];
  template?: { name: string; language: string; parameters: string[] };
  conversationId?: string; revision?: number;
  ruleId?: string; ruleRevision?: string;
}
const records = schema.automationRecords, jobs = schema.automationJobs, events = schema.automationEvents;
const secretKey = createHash("sha256").update(config.appSecret + "tripanza-automation-v1").digest();
const timestamp = () => new Date().toISOString();
const id = () => randomBytes(16).toString("hex");
function seal(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", secretKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
function open(value: string) {
  const [iv, tag, content] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", secretKey, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(content, "base64url")), decipher.final()]).toString("utf8");
}
export async function record(key: string): Promise<Data | null> {
  const [row] = await db.select().from(records).where(eq(records.id, key)).limit(1);
  return row ? JSON.parse(row.data) : null;
}
async function save(key: string, kind: string, data: Data) {
  await db.insert(records).values({ id: key, kind, data: JSON.stringify(data), updated_at: timestamp() })
    .onConflictDoUpdate({ target: records.id, set: { data: JSON.stringify(data), updated_at: timestamp() } });
}
export async function listRecords(kind: string) {
  return (await db.select().from(records).where(eq(records.kind, kind)).orderBy(desc(records.updated_at)).limit(100)).map(row => ({ ...JSON.parse(row.data), id: row.id }));
}
export function recipient(value: unknown) {
  if (typeof value !== "string") throw new Error("Enter a phone number or group JID");
  const clean = value.trim().replace(/^\+/, "");
  if (/^\d{7,15}$/.test(clean)) return clean + "@s.whatsapp.net";
  if (/^\d{7,20}(?:-\d+)?@(?:g\.us|s\.whatsapp\.net|lid)$/.test(clean)) return clean;
  throw new Error("Enter an international phone number or valid WhatsApp JID");
}
function text(value: unknown, name: string, max = 4000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Enter ${name} (up to ${max} characters)`);
  return value.trim();
}
export function validatePayload(value: any): MessagePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter message content");
  const payload: MessagePayload = { text: typeof value.text === "string" ? value.text.trim() : "" };
  if (payload.text.length > 4000) throw new Error("Message must be at most 4000 characters");
  if (value.media) {
    if (!["image", "video", "document"].includes(value.media.kind)) throw new Error("Choose image, video or document");
    payload.media = { kind: value.media.kind, url: publicUrl(value.media.url), fileName: String(value.media.fileName || "attachment").replace(/[\\/\r\n]/g, "_").slice(0, 100) };
  }
  if (value.buttons?.length) {
    if (!Array.isArray(value.buttons) || value.buttons.length > 3) throw new Error("Use at most three buttons");
    payload.buttons = value.buttons.map((button: any) => {
      if (!["url", "reply"].includes(button.kind)) throw new Error("Choose URL or reply button");
      return { kind: button.kind, label: text(button.label, "button label", 20), value: button.kind === "url" ? publicUrl(button.value) : text(button.value, "button response", 100) };
    });
  }
  if (value.template) payload.template = { name: text(value.template.name, "approved template name", 100), language: text(value.template.language || "en", "template language", 20), parameters: (value.template.parameters || []).slice(0, 20).map((item: unknown) => text(item, "template parameter", 1024)) };
  if (payload.template && (payload.media || payload.buttons?.length)) throw new Error("Use the approved template's configured buttons; choose a regular message to add media or custom buttons");
  if (!payload.text && !payload.media && !payload.template) throw new Error("Enter message text, media or approved template");
  return payload;
}
export async function accounts() {
  const stored = await listRecords("account");
  const all: Data[] = [{ id: "crm", name: "CRM / AI assistant", type: "qr" }, { id: "notifications", name: "Notifications / OTP", type: "qr" }, ...stored];
  return Promise.all(all.map(async item => ({ ...item, ...(item.type === "cloud" ? { status: item.accessToken ? "configured" : "disconnected", qr: null }
    : await getGatewayAdapter()?.accountStatus?.(item.id) || { status: item.id === "crm" ? (await getGatewayAdapter()?.status())?.status || "disconnected" : "disconnected", qr: null }), accessToken: undefined, appSecret: undefined, verifyToken: undefined, configured: !!item.accessToken })));
}
export async function saveAccount(value: any, key?: string) {
  const previous = key ? await record(key) : null;
  if (key && (!previous || !["qr", "cloud"].includes(previous.type))) throw new Error("Account not found");
  if (!key && (await listRecords("account")).length >= 4) throw new Error("Up to four additional accounts are supported on this service");
  if (!["qr", "cloud"].includes(value.type) || previous && value.type !== previous.type) throw new Error("Choose a QR or Meta account; create a new account to change type");
  const accountId = key || `account_${id()}`;
  const data: Data = { ...previous, name: text(value.name, "account name", 80), type: value.type };
  if (value.type === "cloud") {
    data.phoneNumberId = text(value.phoneNumberId, "Meta phone number ID", 30);
    if (!/^\d+$/.test(data.phoneNumberId)) throw new Error("Meta phone number ID must be numeric");
    data.apiVersion = text(value.apiVersion || "v23.0", "Graph API version", 12);
    if (!/^v\d+\.\d+$/.test(data.apiVersion)) throw new Error("Enter a Graph version such as v23.0");
    for (const field of ["accessToken", "appSecret", "verifyToken"]) {
      if (value[field]) data[field] = seal(text(value[field], field, 4096));
      if (!data[field]) throw new Error(`Enter ${field}`);
    }
  }
  await save(accountId, "account", data);
  return accountId;
}
export async function accountAction(key: string, action: string) {
  if (!["crm", "notifications"].includes(key) && !await record(key)) throw new Error("Account not found");
  const stored = await record(key);
  if (stored?.type === "cloud") {
    if (action !== "test") throw new Error("Meta accounts use API credentials, not QR pairing");
    const response = await publicRequest(`https://graph.facebook.com/${stored.apiVersion}/${stored.phoneNumberId}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${open(stored.accessToken)}` } });
    if (response.status !== 200) throw new Error("Meta connection failed; check credentials and permissions");
    return { success: true };
  }
  if (!["connect", "pause", "logout"].includes(action)) throw new Error("Unknown account action");
  const adapter = getGatewayAdapter();
  if (!adapter?.accountAction) throw new Error("Account controls unavailable");
  await adapter.accountAction(key, action as "connect" | "pause" | "logout");
  if (stored) await save(key, "account", { ...stored, autoConnect: action === "connect" });
  return { success: true };
}
export async function deleteRecord(key: string, kind: string) {
  const [row] = await db.select().from(records).where(and(eq(records.id, key), eq(records.kind, kind))).limit(1);
  if (!row) throw new Error("Item not found");
  if (kind === "account") {
    const item = JSON.parse(row.data);
    if (item.type === "qr") await getGatewayAdapter()?.accountAction?.(key, "remove");
    await db.update(jobs).set({ state: "canceled", updated_at: timestamp() }).where(and(eq(jobs.gateway_id, key), inArray(jobs.state, ["draft", "queued"])));
  }
  await db.delete(records).where(eq(records.id, key));
}
export async function saveRule(value: any, key?: string) {
  if (key && !(await listRecords("rule")).some(rule => rule.id === key)) throw new Error("Rule not found");
  if (!key && (await listRecords("rule")).length >= 100) throw new Error("Up to 100 keyword rules are supported");
  const data = { name: text(value.name, "rule name", 80), gatewayId: value.gatewayId || "crm", keyword: text(value.keyword, "keyword", 100),
    match: value.match, context: value.context, priority: Number(value.priority) || 0, enabled: value.enabled === true,
    cooldownSeconds: Math.max(30, Math.min(86400, Number(value.cooldownSeconds) || 60)),
    whitelist: (value.whitelist || []).slice(0, 100).map(recipient), blacklist: (value.blacklist || []).slice(0, 100).map(recipient), payload: validatePayload(value.payload), revision: id() };
  if (!["exact", "contains", "starts_with"].includes(data.match) || !["all", "private", "group"].includes(data.context)) throw new Error("Choose matching mode and chat context");
  await requireAccount(data.gatewayId);
  const ruleId = key || id(); await save(ruleId, "rule", data); return ruleId;
}
async function requireAccount(key: string) {
  if (["crm", "notifications"].includes(key)) return;
  const account = /^account_[a-f0-9]{32}$/.test(key) ? await record(key) : null;
  if (!account || !["qr", "cloud"].includes(account.type)) throw new Error("Choose an existing account");
}
export async function createJobs(value: any) {
  await requireAccount(value.gatewayId || "crm");
  const recipients = [...new Set<string>((value.recipients || []).map(recipient))];
  if (!recipients.length || recipients.length > 1000) throw new Error("Choose 1–1000 recipients");
  const payload = validatePayload(value.payload);
  try { new Intl.DateTimeFormat("en", { timeZone: value.timezone || config.timezone }); } catch { throw new Error("Choose a valid timezone"); }
  const account = await record(value.gatewayId || "crm");
  if (account?.type === "cloud" && recipients.some(jid => !jid.endsWith("@s.whatsapp.net"))) throw new Error("Choose personal phone numbers for Meta accounts");
  const due = value.dueAt ? new Date(value.dueAt) : new Date();
  if (!Number.isFinite(due.getTime())) throw new Error("Choose a valid scheduled date");
  const campaignId = id();
  await db.transaction(async tx => {
    await tx.insert(records).values({ id: campaignId, kind: "campaign", data: JSON.stringify({ name: text(value.name || "Scheduled message", "campaign name", 100), timezone: value.timezone || config.timezone, count: recipients.length }), updated_at: timestamp() });
    for (let index = 0; index < recipients.length; index++) {
      await tx.insert(jobs).values({ id: id(), campaign_id: campaignId, gateway_id: value.gatewayId || "crm", recipient: recipients[index], payload: JSON.stringify(payload),
        state: "draft", due_at: new Date(due.getTime() + index * 15000).toISOString(), created_at: timestamp(), updated_at: timestamp() });
    }
  });
  return { campaignId, count: recipients.length };
}
export async function campaignAction(key: string, action: string) {
  if (!await record(key)) throw new Error("Campaign not found");
  if (!["start", "pause", "cancel"].includes(action)) throw new Error("Unknown campaign action");
  const state = action === "start" ? "queued" : action === "pause" ? "draft" : "canceled";
  await db.update(jobs).set({ state, updated_at: timestamp() }).where(and(eq(jobs.campaign_id, key), inArray(jobs.state, action === "start" ? ["draft"] : ["draft", "queued"])));
}
export async function listJobs(campaignId?: string, cursor?: { createdAt: string; id: string }) {
  return db.select().from(jobs).where(and(campaignId ? eq(jobs.campaign_id, campaignId) : undefined,
    cursor ? sql`(${jobs.created_at} < ${cursor.createdAt} OR (${jobs.created_at} = ${cursor.createdAt} AND ${jobs.id} < ${cursor.id}))` : undefined)).orderBy(desc(jobs.created_at), desc(jobs.id)).limit(100);
}
export async function campaignSummaries() {
  const campaigns = await listRecords("campaign");
  if (!campaigns.length) return [];
  const counts = await db.select({ campaignId: jobs.campaign_id, state: jobs.state, count: sql<number>`count(*)` }).from(jobs).where(inArray(jobs.campaign_id, campaigns.map(campaign => campaign.id))).groupBy(jobs.campaign_id, jobs.state);
  return campaigns.map(campaign => ({ ...campaign, states: Object.fromEntries(counts.filter(row => row.campaignId === campaign.id).map(row => [row.state, row.count])) }));
}
let hooks: { recordOutgoing?: (jid: string, content: Data, sent: proto.IWebMessageInfo) => Promise<void> } = {};
let interval: NodeJS.Timeout | null = null, running: Promise<void> | null = null, stopped = true;
let nextMessageAt = 0, nextCleanupAt = 0;
class DeliveryError extends Error {}
class CanceledReply extends Error {}
async function replyAllowed(payload: MessagePayload) {
  if (payload.ruleId) {
    const rule = await record(payload.ruleId);
    if (rule?.gatewayId === "crm" && !await crmAutoRepliesAllowed()) return false;
    if (!rule?.enabled || rule.revision !== payload.ruleRevision) return false;
  }
  if (!payload.conversationId) return true;
  if (!await crmAutoRepliesAllowed()) return false;
  const [chat] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, payload.conversationId)).limit(1);
  return !!chat && !chat.ai_paused && chat.status === "bot" && chat.ai_revision === payload.revision && !chat.claimed_by;
}
export async function cleanupAutomation() {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  await db.delete(records).where(and(inArray(records.kind, ["seen", "cooldown", "cloud-session"]), lte(records.updated_at, weekAgo)));
  await db.delete(events).where(sql`${events.id} NOT IN (SELECT id FROM automation_events ORDER BY created_at DESC LIMIT 5000)`);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  await db.delete(jobs).where(and(inArray(jobs.state, ["sent", "delivered", "read", "failed", "canceled", "unknown"]), lte(jobs.updated_at, monthAgo)));
  await db.delete(records).where(and(eq(records.kind, "campaign"), lte(records.updated_at, monthAgo), sql`${records.id} NOT IN (SELECT campaign_id FROM automation_jobs WHERE campaign_id IS NOT NULL)`));
}
export async function initAutomation(value: typeof hooks = {}, options: { manual?: boolean } = {}) {
  if (options.manual && config.nodeEnv !== "test") throw new Error("Manual worker is available only in isolated tests");
  if (interval) clearInterval(interval);
  hooks = value; stopped = false;
  nextMessageAt = 0;
  // A process can die after WhatsApp accepted a message but before the DB commit.
  // Do not automatically resend that uncertain message on startup.
  await db.update(jobs).set({ state: "unknown", error: "Process restarted during delivery; verify before creating a new send", updated_at: timestamp() }).where(eq(jobs.state, "sending"));
  interval = options.manual ? null : setInterval(() => { runAutomationTick().catch(() => console.error("[automation] Queue processing failed; check delivery records.")); }, 1000);
  interval?.unref();
  for (const account of await listRecords("account")) {
    if (account.type === "qr" && account.autoConnect) await getGatewayAdapter()?.accountAction?.(account.id, "connect").catch(() => console.error("[automation] Saved account could not connect; retry from Accounts."));
  }
}
export async function stopAutomation() { stopped = true; if (interval) clearInterval(interval); interval = null; await running; }
export function runAutomationTick() {
  if (running) return running;
  running = processQueue().finally(() => { running = null; }); return running;
}
async function processQueue() {
  if (stopped) return;
  if (Date.now() >= nextCleanupAt) { nextCleanupAt = Date.now() + 3600000; await cleanupAutomation(); }
  const [job] = await db.select().from(jobs).where(and(eq(jobs.state, "queued"), lte(jobs.due_at, timestamp()), Date.now() < nextMessageAt ? eq(jobs.recipient, "webhook") : undefined)).orderBy(jobs.due_at).limit(1);
  if (!job) return;
  const payload = JSON.parse(job.payload);
  if (payload.webhookId) { await deliverWebhook(job, payload); return; }
  if (!await replyAllowed(payload)) { await db.update(jobs).set({ state: "canceled", updated_at: timestamp() }).where(eq(jobs.id, job.id)); return; }
  const account = await record(job.gateway_id);
  if (account?.type !== "cloud") {
    const adapter = getGatewayAdapter();
    const state = adapter?.accountStatus ? await adapter.accountStatus(job.gateway_id) : job.gateway_id === "crm" ? await adapter?.status() : null;
    if (state?.status !== "connected") {
      await db.update(jobs).set({ due_at: new Date(Date.now() + 30000).toISOString(), error: "Account offline; waiting for connection", updated_at: timestamp() }).where(eq(jobs.id, job.id)); return;
    }
  }
  const claimed = await db.update(jobs).set({ state: "sending", attempts: job.attempts + 1, error: null, updated_at: timestamp() }).where(and(eq(jobs.id, job.id), eq(jobs.state, "queued"))).returning();
  if (!claimed.length) return;
  nextMessageAt = Date.now() + 10000 + Math.floor(Math.random() * 20000);
  let accepted: proto.IWebMessageInfo | null = null;
  try {
    const sent = await deliverMessage(job.gateway_id, job.recipient, payload);
    if (!sent?.key?.id) throw new Error("WhatsApp acceptance missing");
    accepted = sent;
    await db.update(jobs).set({ state: "sent", message_id: sent.key?.id || null, updated_at: timestamp() }).where(eq(jobs.id, job.id));
    if (job.gateway_id === "crm") await hooks.recordOutgoing?.(job.recipient, messageContent(payload), sent).catch(() => console.error("[automation] Accepted message could not be recorded in the inbox."));
    await publishEvent(job.gateway_id, "message.accepted", { jobId: job.id, recipient: job.recipient, messageId: sent.key?.id });
  } catch (error) {
    await db.update(jobs).set({ state: accepted ? "sent" : error instanceof CanceledReply ? "canceled" : error instanceof DeliveryError ? "failed" : "unknown", message_id: accepted?.key?.id || null,
      error: accepted ? "Message accepted; event logging failed" : error instanceof CanceledReply ? "Chat is no longer available to the bot" : error instanceof DeliveryError ? error.message : "Delivery did not complete; check WhatsApp before resending", updated_at: timestamp() }).where(eq(jobs.id, job.id));
  }
}
function messageContent(payload: MessagePayload): Data {
  const fallback = (payload.buttons || []).map(button => button.kind === "url" ? `${button.label}: ${button.value}` : `${button.label} — reply: ${button.value}`).join("\n");
  const body = [payload.text, fallback].filter(Boolean).join("\n\n");
  if (payload.media) return { [payload.media.kind]: { url: payload.media.url }, caption: body, fileName: payload.media.fileName };
  return { text: body };
}
async function deliverMessage(gatewayId: string, jid: string, payload: MessagePayload): Promise<proto.IWebMessageInfo> {
  const account = await record(gatewayId);
  if (account?.type === "cloud") return sendCloud(gatewayId, account, jid, payload);
  const content = messageContent(payload);
  if (payload.media) {
    let response;
    try { response = await publicRequest(payload.media.url, { maxBytes: 8 * 1024 * 1024 }); }
    catch { throw new DeliveryError("Could not fetch the attachment; no message was sent"); }
    const supported = payload.media.kind === "image" ? /^image\/(jpeg|png|webp)$/.test(response.mime)
      : payload.media.kind === "video" ? response.mime === "video/mp4" : response.mime === "application/pdf";
    if (response.status !== 200 || !supported) throw new DeliveryError("Attachment has an unsupported type; no message was sent");
    if (payload.media.kind === "document" && !response.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new DeliveryError("Attachment is not a PDF; no message was sent");
    content[payload.media.kind] = response.body; content.mimetype = response.mime;
  }
  const settings = await record("button-settings");
  if (payload.buttons?.length && settings?.mode === "experimental" && !payload.media) content.__interactiveButtons = payload.buttons;
  const adapter = getGatewayAdapter();
  if (!await replyAllowed(payload)) throw new CanceledReply();
  if (gatewayId === "crm" && !content.__interactiveButtons) {
    const sent = await sendWaMessage(jid, content as any);
    if (!sent) throw new Error("WhatsApp acceptance missing");
    return sent;
  }
  if (!adapter?.accountSend) throw new Error("Account sending unavailable");
  return adapter.accountSend(gatewayId, jid, content);
}
async function sendCloud(gatewayId: string, account: Data, jid: string, payload: MessagePayload): Promise<proto.IWebMessageInfo> {
  if (!jid.endsWith("@s.whatsapp.net")) throw new DeliveryError("Meta account supports personal phone numbers only");
  const to = jid.split("@")[0]; let message: Data;
  if (payload.template) message = { type: "template", template: { name: payload.template.name, language: { code: payload.template.language }, components: payload.template.parameters.length ? [{ type: "body", parameters: payload.template.parameters.map(value => ({ type: "text", text: value })) }] : [] } };
  else {
    const session = await record(`cloud-session:${gatewayId}:${to}`);
    if (!session || Date.now() - session.lastInbound > 24 * 60 * 60 * 1000) throw new DeliveryError("Outside Meta reply window; use an approved template");
    const buttons = payload.buttons || [];
    if (buttons.length && !payload.media) {
      const urls = buttons.filter(button => button.kind === "url");
      if (urls.length > 1 || urls.length && buttons.length > 1) throw new DeliveryError("Use one URL button or up to three reply buttons for Meta");
      message = { type: "interactive", interactive: { type: urls.length ? "cta_url" : "button", body: { text: payload.text }, action: urls.length ? { name: "cta_url", parameters: { display_text: urls[0].label, url: urls[0].value } } : { buttons: buttons.map(button => ({ type: "reply", reply: { id: button.value, title: button.label } })) } } };
    } else if (payload.media) message = { type: payload.media.kind, [payload.media.kind]: { link: payload.media.url, caption: messageContent(payload).caption, ...(payload.media.kind === "document" ? { filename: payload.media.fileName } : {}) } };
    else message = { type: "text", text: { body: messageContent(payload).text } };
  }
  const response = await publicRequest(`https://graph.facebook.com/${account.apiVersion}/${account.phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${open(account.accessToken)}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, ...message }) });
  if (response.status !== 200) throw new DeliveryError("Meta rejected the message; check template, credentials and permissions");
  const result = JSON.parse(response.body.toString());
  if (!result.messages?.[0]?.id) throw new Error("Meta acceptance missing");
  return { key: { remoteJid: jid, id: result.messages[0].id, fromMe: true }, message: { conversation: payload.text } };
}
export async function keywordReply(gatewayId: string, jid: string, message: string, guard?: { conversationId: string; revision: number }, senderJid?: string) {
  if (gatewayId === "crm" && !await crmAutoRepliesAllowed()) return false;
  const list = (await listRecords("rule")).sort((a, b) => b.priority - a.priority);
  const normalized = message.trim().toLowerCase(), group = jid.endsWith("@g.us");
  for (const rule of list) {
    if (!rule.enabled || rule.gatewayId !== gatewayId || rule.context === "private" && group || rule.context === "group" && !group
      || rule.blacklist.some((item: string) => item === jid || item === senderJid)
      || rule.whitelist.length && !rule.whitelist.some((item: string) => item === jid || item === senderJid)) continue;
    const keyword = rule.keyword.toLowerCase();
    if (!(rule.match === "exact" ? normalized === keyword : rule.match === "starts_with" ? normalized.startsWith(keyword) : normalized.includes(keyword))) continue;
    const cooldownId = `cooldown:${rule.id}:${gatewayId}:${jid}`;
    await db.transaction(async tx => {
      const [last] = await tx.select().from(records).where(eq(records.id, cooldownId)).limit(1);
      if (last && Date.now() - JSON.parse(last.data).at < rule.cooldownSeconds * 1000) return;
      await tx.insert(records).values({ id: cooldownId, kind: "cooldown", data: JSON.stringify({ at: Date.now() }), updated_at: timestamp() }).onConflictDoUpdate({ target: records.id, set: { data: JSON.stringify({ at: Date.now() }), updated_at: timestamp() } });
      await tx.insert(jobs).values({ id: id(), gateway_id: gatewayId, recipient: jid, payload: JSON.stringify({ ...rule.payload, ruleId: rule.id, ruleRevision: rule.revision, ...guard }), state: "queued", due_at: timestamp(), created_at: timestamp(), updated_at: timestamp() });
    });
    return true;
  }
  return false;
}
export function incomingText(message: proto.IWebMessageInfo) {
  const content = message.message;
  if (!content) return "";
  const native = content.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (native) { try { const value = JSON.parse(native); return String(value.id || value.selected_id || "").slice(0, 4000); } catch { return ""; } }
  return content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption
    || content.videoMessage?.caption || content.documentMessage?.caption || content.buttonsResponseMessage?.selectedButtonId
    || content.templateButtonReplyMessage?.selectedId || content.listResponseMessage?.singleSelectReply?.selectedRowId || "";
}
export async function handleAccountIncoming(gatewayId: string, message: proto.IWebMessageInfo) {
  const jid = message.key?.remoteJid;
  if (!jid || message.key?.fromMe || jid === "status@broadcast") return false;
  const content = incomingText(message);
  if (!content) return false;
  const eventId = `${gatewayId}:${jid}:${message.key?.id || id()}`;
  const remembered = await db.insert(records).values({ id: `seen:${eventId}`, kind: "seen", data: "{}", updated_at: timestamp() }).onConflictDoNothing().returning();
  if (!remembered.length) return false;
  await publishEvent(gatewayId, "message.received", { recipient: jid, text: content.slice(0, 4000), messageId: message.key?.id });
  if (gatewayId !== "crm") await keywordReply(gatewayId, jid, content, undefined, (message.key as any)?.senderPn);
  return true;
}
export async function publishEvent(gatewayId: string, event: string, data: Data) {
  if (event === "message.status" && data.messageId && ["sent", "delivered", "read", "failed"].includes(data.status)) {
    const eligible = data.status === "sent" ? ["unknown", "sending", "sent"] : data.status === "failed" ? ["unknown", "sending", "sent", "failed"] : data.status === "delivered" ? ["unknown", "sending", "sent", "failed", "delivered"] : ["unknown", "sending", "sent", "failed", "delivered", "read"];
    await db.update(jobs).set({ state: data.status, updated_at: timestamp() }).where(and(eq(jobs.gateway_id, gatewayId), eq(jobs.message_id, data.messageId), inArray(jobs.state, eligible)));
  }
  const eventId = id(), created = timestamp();
  await db.insert(events).values({ id: eventId, gateway_id: gatewayId, event, data: JSON.stringify(data), created_at: created });
  for (const webhook of await listRecords("webhook")) {
    if (!webhook.enabled || webhook.gatewayId !== "all" && webhook.gatewayId !== gatewayId || !webhook.events.includes(event)) continue;
    const payload = { webhookId: webhook.id, envelope: { id: eventId, event, gatewayId, timestamp: created, data } };
    await db.insert(jobs).values({ id: id(), gateway_id: gatewayId, recipient: "webhook", payload: JSON.stringify(payload), state: "queued", due_at: created, created_at: created, updated_at: created });
  }
}
export async function saveWebhook(value: any, key?: string) {
  const previous = key ? await record(key) : null;
  if (key && !previous) throw new Error("Webhook not found");
  if (!key && (await listRecords("webhook")).length >= 20) throw new Error("Up to 20 webhooks are supported");
  const secret = value.secret ? seal(text(value.secret, "signing secret", 4096)) : previous?.secret;
  if (!secret) throw new Error("Enter a signing secret");
  const selected = (value.events || []).filter((event: string) => ["message.received", "message.accepted", "message.status", "connection", "group.updated"].includes(event));
  if (!selected.length) throw new Error("Select webhook events");
  if (value.gatewayId && value.gatewayId !== "all") await requireAccount(value.gatewayId);
  const keyId = key || id(); await save(keyId, "webhook", { name: text(value.name, "webhook name", 80), url: publicUrl(value.url), gatewayId: value.gatewayId || "all", events: selected, enabled: value.enabled === true, secret }); return keyId;
}
async function deliverWebhook(job: typeof jobs.$inferSelect, payload: Data) {
  const webhook = await record(payload.webhookId);
  if (!webhook?.enabled) { await db.update(jobs).set({ state: "canceled" }).where(eq(jobs.id, job.id)); return; }
  await db.update(jobs).set({ state: "sending", attempts: job.attempts + 1, updated_at: timestamp() }).where(eq(jobs.id, job.id));
  try {
    const body = JSON.stringify(payload.envelope);
    const response = await publicRequest(webhook.url, { method: "POST", headers: { "Content-Type": "application/json", "X-Tripanza-Event-ID": payload.envelope.id, "X-Tripanza-Signature": `sha256=${createHmac("sha256", open(webhook.secret)).update(body).digest("hex")}` }, body });
    if (response.status < 200 || response.status >= 300) throw new Error("Webhook rejected");
    await db.update(jobs).set({ state: "sent", error: null, updated_at: timestamp() }).where(eq(jobs.id, job.id));
  } catch {
    await db.update(jobs).set({ state: job.attempts >= 4 ? "failed" : "queued", due_at: new Date(Date.now() + 10000 * 2 ** job.attempts).toISOString(), error: "Webhook delivery failed", updated_at: timestamp() }).where(eq(jobs.id, job.id));
  }
}
export async function listEvents(gatewayId?: string) { return db.select().from(events).where(gatewayId ? eq(events.gateway_id, gatewayId) : undefined).orderBy(desc(events.created_at)).limit(100); }
export async function buttonSettings(value?: any) {
  if (value) {
    if (!["links", "experimental"].includes(value.mode)) throw new Error("Choose links or experimental buttons");
    await save("button-settings", "settings", { mode: value.mode });
  }
  return await record("button-settings") || { mode: "links" };
}
export async function decorateButtons(content: Data) {
  if (!content.text || content.__interactiveButtons || content.__plain || (await buttonSettings()).mode !== "experimental") return content;
  const match = content.text.match(/https:\/\/[^\s<>'"`]+/i);
  if (!match) return content;
  const url = match[0].replace(/[),.!?]+$/g, "");
  try { publicUrl(url); } catch { return content; }
  return { ...content, __interactiveButtons: [{ kind: "url", label: /\.pdf|generate_pdf/i.test(url) ? "Open itinerary" : /checkout|booking/i.test(url) ? "Book this trip" : "View trip details", value: url }] };
}
export async function createApiKey(name: string, userId: string) {
  if ((await listRecords("api-key")).length >= 20) throw new Error("Up to 20 automation API keys are supported");
  const token = `tripanza_${randomBytes(32).toString("hex")}`, key = id();
  await save(key, "api-key", { name: text(name, "API key name", 80), hash: createHash("sha256").update(token).digest("hex"), userId });
  return { id: key, token };
}
export async function apiKeyUser(token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  const key = (await listRecords("api-key")).find(item => item.hash === hash);
  if (!key) return null;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, key.userId)).limit(1);
  return user?.is_active && ["admin", "super_admin"].includes(user.role) ? user : null;
}
export async function groupAction(gatewayId: string, action: string, data: Data) {
  await requireAccount(gatewayId);
  if ((await record(gatewayId))?.type === "cloud") throw new Error("Group management requires a QR-linked account");
  if (!["list", "details", "create", "subject", "description", "participants", "announcement"].includes(action)) throw new Error("Choose a group action");
  const sanitized: Data = {};
  if (!["list", "create"].includes(action)) {
    sanitized.jid = recipient(data.jid);
    if (!sanitized.jid.endsWith("@g.us")) throw new Error("Choose a group JID");
  }
  if (["create", "subject"].includes(action)) sanitized.subject = text(data.subject, "group name", 100);
  if (action === "description") sanitized.description = typeof data.description === "string" ? data.description.slice(0, 2048) : "";
  if (["create", "participants"].includes(action)) {
    sanitized.participants = (data.participants || []).slice(0, 100).map(recipient);
    if (!sanitized.participants.length || sanitized.participants.some((item: string) => !item.endsWith("@s.whatsapp.net"))) throw new Error("Enter personal phone numbers");
  }
  if (action === "participants") {
    if (!["add", "remove", "promote", "demote"].includes(data.operation)) throw new Error("Choose participant action");
    sanitized.operation = data.operation;
  }
  if (action === "announcement") sanitized.enabled = data.enabled === true;
  const adapter = getGatewayAdapter();
  if (!adapter?.groupAction) throw new Error("Group controls unavailable");
  const result = await adapter.groupAction(gatewayId, action, sanitized);
  if (action !== "list" && action !== "details") await publishEvent(gatewayId, "group.updated", { action, jid: sanitized.jid || result?.id });
  return result;
}
export async function verifyCloudWebhook(gatewayId: string, token: string) {
  const account = await record(gatewayId);
  return account?.type === "cloud" && token === open(account.verifyToken);
}
export async function acceptCloudWebhook(gatewayId: string, body: Buffer, signature: string) {
  const account = await record(gatewayId);
  if (account?.type !== "cloud") throw new Error("Unknown Meta account");
  const expected = Buffer.from(`sha256=${createHmac("sha256", open(account.appSecret)).update(body).digest("hex")}`);
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("Invalid webhook signature");
  const content = JSON.parse(body.toString());
  for (const entry of (content.entry || []).slice(0, 20)) for (const change of (entry.changes || []).slice(0, 20)) {
    const value = change.value;
    if (String(value?.metadata?.phone_number_id) !== account.phoneNumberId) continue;
    for (const message of (value.messages || []).slice(0, 100)) {
      if (!/^\d{7,15}$/.test(message.from)) continue;
      const inboundText = message.text?.body || message.interactive?.button_reply?.id || message.button?.payload || message.image?.caption || message.document?.caption || "";
      await save(`cloud-session:${gatewayId}:${message.from}`, "cloud-session", { lastInbound: Number(message.timestamp) * 1000 || Date.now() });
      await handleAccountIncoming(gatewayId, { key: { id: message.id, remoteJid: `${message.from}@s.whatsapp.net`, fromMe: false }, message: { conversation: inboundText }, pushName: value.contacts?.find((item: any) => item.wa_id === message.from)?.profile?.name });
    }
    for (const status of (value.statuses || []).slice(0, 100)) {
      if (!["sent", "delivered", "read", "failed"].includes(status.status)) continue;
      await publishEvent(gatewayId, "message.status", { messageId: status.id, status: status.status });
    }
  }
}
