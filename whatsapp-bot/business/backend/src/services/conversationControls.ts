import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { crmAutoRepliesAllowed } from "./crmReplyControls.js";

export class ConversationControlError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function canGenerateReply(id: string, revision: number) {
  if (!await crmAutoRepliesAllowed()) return false;
  const [chat] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, id)).limit(1);
  return !!chat && chat.status === "bot" && !chat.claimed_by && !chat.ai_paused && chat.ai_revision === revision;
}
export async function resumeWaitingConversation(id: string) {
  const [chat] = await db.update(schema.conversations).set({ status: "bot", ai_revision: sql`${schema.conversations.ai_revision} + 1`, updated_at: new Date().toISOString() }).where(and(eq(schema.conversations.id, id), eq(schema.conversations.status, "waiting"), eq(schema.conversations.ai_paused, false), sql`${schema.conversations.claimed_by} IS NULL`)).returning();
  return chat;
}
export async function setConversationAi(id: string, paused: boolean, actor: { sub: string; role: string }) {
  return db.transaction(async tx => {
    const [chat] = await tx.select().from(schema.conversations).where(eq(schema.conversations.id, id));
    if (!chat) throw new ConversationControlError(404, "Conversation not found");
    if (chat.status === "resolved") throw new ConversationControlError(409, "This chat is resolved. Open the customer's current conversation to control AI replies.");
    if (actor.role === "cs" && chat.claimed_by && chat.claimed_by !== actor.sub) throw new ConversationControlError(403, "Only the assigned agent or an administrator can control AI replies.");
    const [updated] = await tx.update(schema.conversations).set({
      ai_paused: paused, ai_revision: sql`${schema.conversations.ai_revision} + 1`,
      ...(!paused ? { status: "bot" as const, claimed_by: null, warning_sent: false } : {}),
      updated_at: new Date().toISOString(),
    }).where(eq(schema.conversations.id, id)).returning();
    return updated;
  });
}
export async function deleteWorkspaceConversation(id: string) {
  const result = await db.transaction(async tx => {
    const [chat] = await tx.select().from(schema.conversations).where(eq(schema.conversations.id, id));
    if (!chat) throw new ConversationControlError(404, "Conversation not found");
    const attachments = await tx.select({ url: schema.messages.media_url }).from(schema.messages).where(eq(schema.messages.conversation_id, id));
    await tx.delete(schema.conversations).where(eq(schema.conversations.id, id)); // messages cascade
    const [last] = await tx.select({ id: schema.conversations.id }).from(schema.conversations).where(eq(schema.conversations.customer_id, chat.customer_id)).orderBy(sql`${schema.conversations.created_at} DESC`, sql`${schema.conversations.id} DESC`).limit(1);
    await tx.update(schema.customers).set({ last_conversation_id: last?.id || null, last_summary: null, summary_updated_at: null }).where(eq(schema.customers.id, chat.customer_id));
    const now = new Date().toISOString();
    await tx.insert(schema.customerMemory).values({ customer_id: chat.customer_id, customer_notes: "[]", preferences_json: "{}", reset_at: now, updated_at: now }).onConflictDoUpdate({ target: schema.customerMemory.customer_id, set: { selected_tour: null, customer_notes: "[]", preferences_json: "{}", reset_at: now, updated_at: now } });
    // Invalidate old AI work in any remaining session for the same customer.
    await tx.update(schema.conversations).set({ ai_revision: sql`${schema.conversations.ai_revision} + 1` }).where(and(eq(schema.conversations.customer_id, chat.customer_id), inArray(schema.conversations.status, ["bot", "waiting", "active", "hold"])));
    return { chat, attachments };
  });
  for (const url of new Set(result.attachments.map(a => a.url).filter((url): url is string => !!url && /^\/uploads\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(url)))) {
    const [reference] = await db.select({ id: schema.messages.id }).from(schema.messages).where(eq(schema.messages.media_url, url)).limit(1);
    if (reference) continue;
    try { await unlink(path.join(path.resolve(config.uploadDir), path.basename(url))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") logger.warn("[conversations] Deleted chat attachment cleanup deferred to scheduled cleanup."); }
  }
  return result.chat;
}
