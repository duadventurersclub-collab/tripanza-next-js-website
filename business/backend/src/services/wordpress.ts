import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, and } from "drizzle-orm";
import { config } from "../config.js";
import { db, schema } from "../db/index.js";
import { websiteOrigin, areToursAllowed, getTour, type Tour } from "./website.js";
import { canGenerateReply } from "./conversationControls.js";
import { readMemory } from "./memory.js";

interface Connection { token: string; emailEnabled: boolean; bookingEnabled: boolean; testedAt?: string; origin: string; capabilities?: { email: boolean; booking: boolean } }
export interface ActionContext { id: string; revision: number; customerId: string; phone: string; messageId: string; message: string; history: { role: string; content?: unknown }[]; privateTrip: boolean }
interface Booking { tour_url: string; slug: string; name: string; email: string; phone: string; date: string; quad: number; triple: number; twin: number }
const encryptionContext = Buffer.from("tripanza-wordpress-bridge-v1");
const key = Buffer.from(hkdfSync("sha256", config.appSecret, "tripanza-workspace", encryptionContext, 32));
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function load(): Promise<Connection | null> {
  const row = (await db.select().from(schema.aiCredentials).where(eq(schema.aiCredentials.id, "wordpress")).limit(1))[0];
  if (!row) return null;
  const [version, iv, tag, text] = row.encrypted_key.split(".");
  if (version !== "v1" || !iv || !tag || !text) throw new Error("Replace the WordPress connection key in settings.");
  const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  cipher.setAAD(encryptionContext); cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(text, "base64url")), cipher.final()]).toString());
}
async function store(value: Connection) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv); cipher.setAAD(encryptionContext);
  const text = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  const encrypted_key = ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), text.toString("base64url")].join(".");
  await db.insert(schema.aiCredentials).values({ id: "wordpress", encrypted_key, updated_at: new Date().toISOString() }).onConflictDoUpdate({ target: schema.aiCredentials.id, set: { encrypted_key, updated_at: new Date().toISOString() } });
}
export async function wordpressStatus() {
  const value = await load();
  const connected = !!value?.testedAt && value.origin === websiteOrigin;
  return { configured: !!value, connected, website: websiteOrigin, testedAt: connected ? value!.testedAt : null,
    emailEnabled: !!value?.emailEnabled, bookingEnabled: !!value?.bookingEnabled,
    emailReady: connected && !!value?.emailEnabled && !!value?.capabilities?.email,
    bookingReady: connected && !!value?.bookingEnabled && !!value?.capabilities?.booking };
}
export async function saveWordpressSettings(body: Record<string, unknown>) {
  if (!body || Object.keys(body).some(k => !["token", "emailEnabled", "bookingEnabled"].includes(k)) || typeof body.emailEnabled !== "boolean" || typeof body.bookingEnabled !== "boolean" || body.token !== undefined && (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token.trim()))) throw new Error("Paste the 64-character connection key and select the features to enable.");
  const previous = await load();
  if (!previous && !body.token) throw new Error("Add a WordPress connection key first.");
  const token = typeof body.token === "string" ? body.token.trim() : previous!.token;
  await store({ token, emailEnabled: body.emailEnabled, bookingEnabled: body.bookingEnabled, origin: websiteOrigin,
    ...(previous?.token === token && previous.origin === websiteOrigin ? { testedAt: previous.testedAt, capabilities: previous.capabilities } : {}) });
  return wordpressStatus();
}
export async function disconnectWordpress() { await db.delete(schema.aiCredentials).where(eq(schema.aiCredentials.id, "wordpress")); }
async function request(path: "capabilities" | "quote" | "actions", body?: unknown) {
  const connection = await load();
  if (!connection || connection.origin !== websiteOrigin) throw new Error("Connect WordPress in AI chatbot settings first.");
  const response = await fetch(`${websiteOrigin}/wp-json/tripanza-workspace/v1/${path}`, { method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(path === "capabilities" ? 5000 : 20000),
    headers: { "X-Tripanza-Workspace-Token": connection.token, "Content-Type": "application/json", Accept: "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) { await response.body?.cancel(); throw new Error(response.status === 401 ? "WordPress rejected the connection key." : response.status === 404 ? "Install and activate the Tripanza Workspace Bridge plugin on your website." : response.status === 409 ? "The price changed or the action is already processing. Ask the team to check before trying again." : "WordPress could not verify the requested action. Ask the team to check."); }
  const reader = response.body?.getReader(); if (!reader) throw new Error("WordPress returned no receipt.");
  let size = 0; const chunks: Buffer[] = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 32768) { await reader.cancel(); throw new Error("Invalid WordPress receipt."); } chunks.push(Buffer.from(value)); }
  return JSON.parse(Buffer.concat(chunks).toString());
}
export async function testWordpressConnection() {
  try {
    const result = await request("capabilities");
    if (result.version !== 1 || typeof result.email !== "boolean" || typeof result.booking !== "boolean" || new URL(result.site).origin !== websiteOrigin) throw new Error("The WordPress bridge returned an invalid connection response.");
    const value = (await load())!; await store({ ...value, testedAt: new Date().toISOString(), capabilities: { email: result.email, booking: result.booking } });
    return { success: true, message: result.email && result.booking ? "Connected. Itinerary email and booking functions are ready." : "Connected. Activate the reference Tripanza plugin to enable its missing functions.", status: await wordpressStatus() };
  } catch (error) { const value = await load(); if (value) await store({ ...value, testedAt: undefined, capabilities: undefined }); return { success: false, error: error instanceof Error && !/fetch|JSON|URL|network|timeout/i.test(error.message) ? error.message : "Could not reach the WordPress bridge. Check its plugin and connection key." }; }
}
async function active(context: ActionContext, slug: string, kind: "email" | "booking") {
  const status = await wordpressStatus();
  if (context.privateTrip || !context.messageId || !context.phone || !await canGenerateReply(context.id, context.revision) || !await areToursAllowed([slug])) throw new Error("This action is unavailable for this enquiry.");
  if (!(kind === "email" ? status.emailReady : status.bookingReady)) throw new Error("This WordPress feature is not connected. The team can help.");
}
const cleanText = (text: string) => text.replace(/[\r\n*\[\]<>]/g, " ").slice(0, 160);
const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
export function hasEmailIntent(message: string, history: ActionContext["history"]) {
  if (/\b(?:don't|do not|dont|never|stop|no)\b.*\b(?:email|mail|send)\b/i.test(message)) return false;
  if (/\b(?:email|e-mail|mail)\b/i.test(message) && /itinerary|pdf|brochure|send|share|bhej/i.test(message)) return true;
  const previous = [...history].reverse().find(m => m.role === "assistant")?.content;
  return /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i.test(message) && typeof previous === "string" && /(?:email|e-mail|mail)/i.test(previous) && /itinerary|brochure/i.test(previous) && /\?/.test(previous);
}
export function hasBookingIntent(message: string, history: ActionContext["history"]) {
  if (/\b(?:don't|do not|dont|no|not|cancel|stop)\b.*\b(?:book|confirm|reserve|pay|payment)\b/i.test(message)) return false;
  if (/\b(?:book|reserve|confirm|pay|payment|advance)\b/i.test(message) && !/\b(?:how|what|when|why|policy|process|refund|can i|could i)\b|\?/i.test(message)) return true;
  const previous = [...history].reverse().find(m => m.role === "assistant")?.content;
  return typeof previous === "string" && /\bbooking\b/i.test(previous) && /\?/.test(previous) && /@|\b(?:quad|triple|twin|name|people|travellers)\b|\d{1,2}[/-]\d{1,2}[/-]\d{4}/i.test(message);
}
async function persist(id: string, context: ActionContext, kind: string, state: string, payload: unknown) {
  // A chat may be deleted during network I/O: do not recreate its data.
  if (!await canGenerateReply(context.id, context.revision)) return;
  const values = { conversation_id: context.id, kind, state, payload_json: JSON.stringify(payload), updated_at: new Date().toISOString() };
  await db.insert(schema.workspaceActions).values({ id, ...values }).onConflictDoUpdate({ target: schema.workspaceActions.id, set: values });
}
export async function emailItinerary(context: ActionContext, tour: Tour): Promise<string> {
  await active(context, tour.slug, "email");
  if (!hasEmailIntent(context.message, context.history)) throw new Error("Email the itinerary only when the customer asks, or supplies their email in response to an itinerary-email question.");
  const memory = await readMemory(context.customerId);
  const email = memory.preferences.email;
  if (!email || !/^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i.test(email)) throw new Error("Ask for the missing itinerary email address, one question at a time.");
  const id = digest(`email:${context.id}:${context.messageId}:${tour.slug}:${email.toLowerCase()}`);
  const payload = { request_id: id, kind: "email", tour_url: tour.url, email, phone: context.phone.replace(/\D/g, "") };
  await persist(id, context, "email", "processing", { slug: tour.slug });
  await active(context, tour.slug, "email");
  try {
    const receipt = await request("actions", payload);
    if (receipt.kind !== "email" || receipt.email !== email || !["accepted", "failed"].includes(receipt.status) || typeof receipt.success !== "boolean" || receipt.success !== (receipt.status === "accepted")) throw new Error("Invalid email receipt.");
    await persist(id, context, "email", receipt.success ? "complete" : "failed", { slug: tour.slug });
    return receipt.success ? `*Itinerary email*\n- ${cleanText(tour.title)} itinerary submitted to *${cleanText(email)}*.\n- Check your inbox and spam folder; inbox delivery is not yet confirmed.` : "*Itinerary email*\n- WordPress could not send the itinerary. I'll connect you with the team to help.";
  } catch { await persist(id, context, "email", "uncertain", { slug: tour.slug }); return "*Itinerary email*\n- I couldn't confirm whether the email was sent. I'll connect you with the team to check before sending it again."; }
}
function verifiedQuote(result: any) { return result && typeof result.total === "number" && Number.isFinite(result.total) && result.total > 0 && typeof result.advance === "number" && Number.isFinite(result.advance) && result.advance > 0 && result.advance <= result.total && result.currency === "INR"; }
export async function prepareBooking(context: ActionContext, tour: Tour, args: Record<string, unknown>): Promise<string> {
  await active(context, tour.slug, "booking");
  const existing = (await db.select().from(schema.workspaceActions).where(eq(schema.workspaceActions.id, digest(`draft:${context.id}`))).limit(1))[0];
  if (existing && ["processing", "uncertain"].includes(existing.state)) throw new Error("An earlier booking outcome needs a team check before creating another order.");
  if (!hasBookingIntent(context.message, context.history)) throw new Error("Explain the booking policy first. Prepare an order only for an actual request to book or pay.");
  const memory = await readMemory(context.customerId), p = memory.preferences;
  const evidence = [context.message, ...memory.notes, ...Object.values(p)].join("\n");
  const name = p.name, email = p.email, date = args.date;
  if (!name || !email) throw new Error(`Ask only for the missing ${!name ? "name" : "email"}; use save_preferences for volunteered contact details.`);
  if (typeof date !== "string" || !/^\d{2}\/\d{2}\/\d{4}$/.test(date)) throw new Error("Ask for the exact group departure date.");
  const dates = [date, date.split("/").reverse().join("-"), date.replaceAll("/", "-")];
  const humanDate = new Date(`${date.split("/").reverse().join("-")}T12:00:00Z`);
  if (!Number.isNaN(humanDate.valueOf())) dates.push(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(humanDate));
  if (!dates.some(d => evidence.toLowerCase().includes(d.toLowerCase()))) throw new Error("The departure date must be explicitly supplied by the customer, including the year.");
  for (const field of ["quad", "triple", "twin"]) if (typeof args[field] !== "number" || !Number.isInteger(args[field]) || (args[field] as number) < 0 || (args[field] as number) > 50) throw new Error("Clarify the number of travellers in each sharing type.");
  const quad = args.quad as number, triple = args.triple as number, twin = args.twin as number, pax = quad + triple + twin;
  if (!pax || pax > 50 || !/\b(?:quad|triple|twin)\b/i.test(evidence)) throw new Error("Ask for the travellers and sharing preference before preparing a booking.");
  const payload: Booking = { tour_url: tour.url, slug: tour.slug, name, email, phone: context.phone.replace(/\D/g, ""), date, quad, triple, twin };
  const quote = await request("quote", payload);
  if (!verifiedQuote(quote) || quote.travellers !== pax) throw new Error("WordPress could not verify this booking quote. Ask the team to check.");
  await active(context, tour.slug, "booking");
  const id = digest(`draft:${context.id}`);
  await persist(id, context, "booking", "draft", { payload, quote, preferences: p, createdAt: Date.now(), revision: context.revision, requestId: digest(`booking:${context.id}:${context.messageId}:${JSON.stringify(payload)}`) });
  return `*Review your booking*\n- Trip: *${cleanText(tour.title)}*\n- Departure: *${date}*\n- Travellers: *${pax}* (quad ${quad}, triple ${triple}, twin ${twin})\n- Name: ${cleanText(name)}\n- Email: ${cleanText(email)}\n- Total including configured tax: *${money(quote.total)}*\n- Advance before gateway fees: *${money(quote.advance)}*\n- Excluded trip costs remain extra. Seats and booking require payment and team confirmation.\n\nReply *confirm booking* to create the order and receive your payment links. No order has been created yet.`;
}
function paymentUrl(value: unknown, order: string, path: string) {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.origin === websiteOrigin && !url.username && !url.password && !url.hash && url.pathname.replace(/\/$/, "") === path && url.searchParams.get("order_id") === order && [...url.searchParams.keys()].length === 1 ? url.href : null; } catch { return null; }
}
export async function confirmPendingBooking(context: ActionContext): Promise<{ response: string; shouldEscalate: boolean; selectedTour?: string; evidenceSlugs?: string[] } | null> {
  if (!/^confirm booking[.!\s]*$/i.test(context.message.trim())) return null;
  const row = (await db.select().from(schema.workspaceActions).where(and(eq(schema.workspaceActions.id, digest(`draft:${context.id}`)), eq(schema.workspaceActions.conversation_id, context.id))).limit(1))[0];
  if (!row) return { response: "Which trip would you like to book? I'll prepare the details for you to review first.", shouldEscalate: false };
  const draft = JSON.parse(row.payload_json), payload: Booking = draft.payload;
  const fail = { response: "*Booking check*\n- I couldn't confirm this order. I'll connect you with the team to check before creating another one.", shouldEscalate: true };
  if (row.state === "complete") return { response: "Your order has already been created. Please use the payment links shared above; payment and seat confirmation are still required.", shouldEscalate: false };
  if (!["draft", "processing"].includes(row.state) || Date.now() - draft.createdAt > 15 * 60000 || draft.revision !== context.revision) return { response: "Let's review the booking details again before creating an order. Please share the trip and departure you'd like to book.", shouldEscalate: false };
  try {
    await active(context, payload.slug, "booking");
    if (row.state === "draft") {
      const latest = [...context.history].reverse().find(m => m.role === "assistant")?.content;
      const preferences = (await readMemory(context.customerId)).preferences;
      if (typeof latest !== "string" || !latest.startsWith("*Review your booking*") || ["name", "email", "dates", "travellers", "room_sharing", "trip_type"].some(field => preferences[field] !== draft.preferences?.[field])) return { response: "Let's review your latest booking details before creating an order. Please tell me what you'd like to book.", shouldEscalate: false };
    }
    const tour = await getTour(payload.slug);
    if (tour.url !== payload.tour_url) return fail;
    await persist(row.id, context, "booking", "processing", draft);
    await active(context, payload.slug, "booking");
    const receipt = await request("actions", { request_id: draft.requestId, kind: "booking", ...payload, expected_total: draft.quote.total, expected_advance: draft.quote.advance });
    const order = receipt.order_id;
    if (!receipt.success || receipt.kind !== "booking" || receipt.status !== "pending_payment" || typeof order !== "string" || !/^[1-9]\d*$/.test(order) || !verifiedQuote(receipt)) { await persist(row.id, context, "booking", "uncertain", draft); return fail; }
    const payu = paymentUrl(receipt.payu_url, order, "/advance-payu-payment"), upi = paymentUrl(receipt.upi_url, order, "/advance-upi-payment");
    if (!payu || !upi) { await persist(row.id, context, "booking", "uncertain", draft); return fail; }
    await persist(row.id, context, "booking", "complete", { ...draft, orderId: order });
    return { response: `*Booking created — payment pending*\n- Order: *${order}*\n- Trip: ${cleanText(tour.title)}\n- Departure: ${payload.date}\n- Total including configured tax: *${money(receipt.total)}*\n- Advance before gateway fees: *${money(receipt.advance)}*\n- Payment, availability and team confirmation are required before seats are confirmed.\n\n*Pay advance*\n- PayU: ${payu}\n- UPI: ${upi}`, shouldEscalate: false, selectedTour: payload.slug, evidenceSlugs: [payload.slug] };
  } catch { return fail; }
}

// A tiny stored ZIP avoids a build-time dependency and lets owners upload the plugin directly.
export function wordpressPluginZip() {
  const body = readFileSync(new URL("../../../wordpress/tripanza-workspace-bridge.php", import.meta.url));
  const name = Buffer.from("tripanza-workspace-bridge/tripanza-workspace-bridge.php");
  let crc = 0xffffffff; for (const byte of body) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(body.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + body.length, 16);
  return Buffer.concat([local, name, body, central, name, end]);
}
