import { waEvents, sendWaMessage, getJid, extractWaNumber, downloadWaMedia, getConnectionStatus } from "./waGateway.js";
import {
  findOrCreateCustomer,
  findActiveConversation,
  createConversation,
  addMessage,
  updateConversationStatus,
  getQueueCount,
  getConversation,
  getMessages,
  getLatestConversation,
  updateConversationRating,
} from "./conversation.js";
import { generateBotResponse, detectEscalation, generateSummary } from "./chatbot.js";
import { emitToUser, emitToRole, broadcast } from "../ws/index.js";
import { db, schema } from "../db/index.js";
import { eq, and, isNull } from "drizzle-orm";
import { sendNotificationToAllCs, sendNotificationToUser, sendNotificationToAllAdmins } from "./notifications.js";
import { requestDashboardBroadcast } from "./dashboard.js";
import { notifyNewCustomer, notifyEscalation } from "./waGroupNotif.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { proto } from "@whiskeysockets/baileys";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { clearMemory, rememberCustomerMessage, rememberTour } from "./memory.js";
import { deliverWebsiteMedia } from "./websiteMedia.js";
import { areToursAllowed } from "./website.js";
import type { GroundedReply } from "./groundedChat.js";
import { isAiResumeRequest } from "./consultantFlow.js";
import { resumeWaitingConversation } from "./conversationControls.js";
import { handleAccountIncoming, incomingText, keywordReply } from "./automation.js";
import { teamHandoffMessage } from "./handoffPolicy.js";

async function emitQueueCount() {
  const count = await getQueueCount();
  broadcast("queue:update", { count });

  if (count >= config.notifQueueThreshold) {
    await sendNotificationToAllAdmins({
      title: "Queue needs attention",
      body: `${count} customers are waiting for the team`,
      url: "/cs?tab=waiting",
      tag: "queue-alert",
    });
  }
}

export function initOrchestrator(): void {
  waEvents.on("message", async (msg: proto.IWebMessageInfo) => {
    try {
      await handleIncomingMessage(msg);
    } catch (err) {
      logger.error("[orchestrator] Error handling message:", err);
    }
  });

  waEvents.on("status", (status: string) => {
    broadcast("gateway:status", { status });
    if (status === "disconnected") {
      sendNotificationToAllAdmins({
        title: "WhatsApp Gateway",
        body: "CRM connection lost. Please reconnect.",
        url: "/admin/gateway",
        tag: "gateway-disconnect",
      });
    }
  });

  logger.info("[orchestrator] Initialized");
}

async function processIncomingMessage(msg: proto.IWebMessageInfo): Promise<boolean> {
  const key = msg.key;
  if (!key?.remoteJid) return true;
  if (key.fromMe) return false; // Skip messages sent by CS/bot to prevent loop/duplication

  // Prevent duplicate message processing
  if (key.id) {
    const existing = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.wa_message_id, key.id))
      .limit(1);
    if (existing.length > 0) {
      logger.debug(`[orchestrator] Message ${key.id} already exists, skipping.`);
      return true;
    }
  }

  const jid = key.remoteJid;

  const content = extractMessageText(msg);

  if (content && content.trim().toLowerCase() === "!jid") {
    try {
      await sendWaMessage(jid, { text: `JID: ${jid}` });
    } catch (err) {
      logger.error("[orchestrator] Failed to send !jid reply:", err);
    }
    return true;
  }

  if (jid.includes("@g.us")) { if (await handleAccountIncoming("crm", msg)) await keywordReply("crm", jid, content || ""); return true; }

  const contentType = getMessageContentType(msg);

  // Skip read receipts, delivery updates, and reactions (empty text/content type text)
  if (!content && contentType === "text") {
    logger.debug(`[orchestrator] Empty text message (likely receipt/protocol), skipping: ${key.id}`);
    return true;
  }

  // Prefer key.senderPn (real phone number JID) over remoteJid (which might be a LID)
  const phoneJid = (key as any).senderPn || jid;
  if (!phoneJid.endsWith("@s.whatsapp.net")) return true;
  const waNumber = extractWaNumber(phoneJid);
  const pushName = msg.pushName || waNumber;

  const { customer, isNew } = await findOrCreateCustomer({
    waNumber,
    displayName: pushName,
    jid,
  });

  if (isNew) {
    notifyNewCustomer(pushName, waNumber).catch(
      (err: unknown) => logger.error("[orchestrator] Failed to send new customer notif:", err)
    );
  }

  let activeConv = await findActiveConversation(customer.id);

  // If there's no active conversation, check if it's a rating response
  if (!activeConv && content && /^[1-5]$/.test(content.trim())) {
    const lastConv = await getLatestConversation(customer.id);
    if (lastConv && lastConv.status === "resolved" && !lastConv.rating) {
      const ratingNum = parseInt(content.trim(), 10);
      await updateConversationRating(lastConv.id, ratingNum);
      try {
        await sendWaMessage(jid, { text: "Thank you for your rating!" });
      } catch (err) {
        logger.error("[orchestrator] Failed to send rating thanks", err);
      }
      return true;
    }
  }

  if (!activeConv) {
    activeConv = await createConversation({
      customerId: customer.id,
      waNumber,
      customerName: pushName,
    });
    broadcast("conversation:new", {
      id: activeConv.id,
      wa_number: waNumber,
      customer_name: pushName,
      status: "bot",
      claimed_by: null,
      updated_at: new Date().toISOString(),
    });
    await emitQueueCount();
  }

  let savedMsg: typeof schema.messages.$inferSelect | null = null;

  const contextInfo = msg.message?.extendedTextMessage?.contextInfo ||
                      msg.message?.imageMessage?.contextInfo ||
                      msg.message?.videoMessage?.contextInfo ||
                      msg.message?.documentMessage?.contextInfo;

  let replyToContent: string | undefined = undefined;
  let replyToSender: string | undefined = undefined;

  if (contextInfo) {
    const quotedMsgId = contextInfo.stanzaId;
    if (quotedMsgId) {
      const quotedRows = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.wa_message_id, quotedMsgId))
        .limit(1);
      if (quotedRows.length > 0) {
        const qm = quotedRows[0];
        replyToContent = qm.content || "";
        if (qm.sender === "cs") {
          const qUserRows = await db.select().from(schema.users).where(eq(schema.users.id, qm.cs_id || "")).limit(1);
          replyToSender = qUserRows[0]?.name || "CS";
        } else if (qm.sender === "bot") {
          replyToSender = "Bot";
        } else {
          replyToSender = customer.display_name || customer.wa_number;
        }
      } else {
        const qMsg = contextInfo.quotedMessage;
        if (qMsg) {
          replyToContent = qMsg.conversation || qMsg.extendedTextMessage?.text || qMsg.imageMessage?.caption || qMsg.videoMessage?.caption || "";
          replyToSender = contextInfo.participant ? (contextInfo.participant.includes("@s.whatsapp.net") ? "Customer" : "CS") : "Pesan";
        }
      }
    }
  }

  if (content || contentType !== "text") {
    let mediaUrl: string | undefined;
    let mediaType: string | undefined;
    let fileName: string | undefined;
    let fileSize: number | undefined;

    if (contentType !== "text") {
      const messageType = Object.keys(msg.message || {})[0];
      const media = await downloadWaMedia(msg as any);
      mediaType = messageType;
      const messagePayload = msg.message ? (msg.message as Record<string, unknown>)[messageType] as Record<string, unknown> : undefined;
      const lengthVal = messagePayload?.fileLength;
      if (lengthVal !== undefined && lengthVal !== null) {
        if (typeof lengthVal === "object" && typeof (lengthVal as any).toNumber === "function") {
          fileSize = (lengthVal as any).toNumber();
        } else if (typeof lengthVal === "number") {
          fileSize = lengthVal;
        } else {
          fileSize = parseInt(String(lengthVal), 10);
        }
      }
      fileName = (messagePayload?.fileName as string) || undefined;
      mediaUrl = media ? await saveMediaBuffer(media, mediaType) : undefined;
    }

    savedMsg = await addMessage({
      conversationId: activeConv.id,
      sender: "customer",
      content: content || undefined,
      contentType: contentType as "text" | "image" | "video" | "document",
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaType || undefined,
      fileName: fileName || undefined,
      fileSize: fileSize || undefined,
      waMessageId: msg.key?.id || undefined,
      replyToContent,
      replyToSender,
    });
  } else {
    savedMsg = await addMessage({
      conversationId: activeConv.id,
      sender: "customer",
      content: "",
      contentType: "text",
      waMessageId: msg.key?.id || undefined,
      replyToContent,
      replyToSender,
    });
  }

  if (savedMsg) {
    await handleAccountIncoming("crm", msg);
    requestDashboardBroadcast();
    emitToUser(activeConv.claimed_by || "none", "conversation:message", {
      conversationId: activeConv.id,
      message: savedMsg,
    });
    emitToRole("cs", "conversation:message", {
      conversationId: activeConv.id,
      message: savedMsg,
    });
    emitToRole("admin", "conversation:message", {
      conversationId: activeConv.id,
      message: savedMsg,
    });
  }

  if (config.website.enabled && content) {
    if (/^(?:forget (?:my |our )?(?:memory|preferences|context)|reset (?:my )?memory|\/forget)$/i.test(content.trim())) {
      await clearMemory(customer.id);
      if (activeConv.status === "bot" && !activeConv.ai_paused) {
        const response = "I've cleared your saved trip context and preferences. Which trip would you like to explore?";
        const sent = await sendWaMessage(jid, { text: response });
        const saved = await addMessage({ conversationId: activeConv.id, sender: "bot", content: response, waMessageId: sent?.key?.id || undefined });
        broadcast("conversation:message", { conversationId: activeConv.id, message: saved });
        return true;
      }
    } else await rememberCustomerMessage(customer.id, content);
  }

  if (config.aiMode === "workspace" && content && isAiResumeRequest(content) && activeConv.status === "waiting" && !activeConv.claimed_by && !activeConv.ai_paused) {
    const resumed = await resumeWaitingConversation(activeConv.id);
    if (resumed) {
      activeConv = resumed;
      broadcast("conversation:ai", { conversationId: resumed.id, paused: false, revision: resumed.ai_revision, status: "bot", claimedBy: null });
      broadcast("conversation:status", { conversationId: resumed.id, status: "bot", claimedBy: null });
      await emitQueueCount(); requestDashboardBroadcast();
    }
  }

  if (activeConv.status === "active" || activeConv.status === "hold") {
    // CS already claimed, notify them about new message
    if (activeConv.claimed_by) {
      await sendNotificationToUser(activeConv.claimed_by, {
        title: `${pushName}`,
        body: content ? content.substring(0, 100) : "New attachment",
        url: `/cs/${activeConv.id}`,
        tag: `conv-${activeConv.id}`,
      });
    }
    return true;
  }

  if (activeConv.status === "bot" || activeConv.status === "waiting") {
    const aiState = await getConversation(activeConv.id);
    if (!aiState || aiState.ai_paused) return true;
    if (activeConv.status === "bot" && content) {
      const botConfigRows = await db.select().from(schema.botConfig).limit(1);
      const keywords = (botConfigRows[0]?.escalation_keywords || "#chatcs").split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
      const escalate = detectEscalation(content, keywords);
      if (!escalate && await keywordReply("crm", jid, content, { conversationId: activeConv.id, revision: aiState.ai_revision }, phoneJid)) return true;
      if (config.aiMode === "wordpress" && !escalate) return false;
      const reply: GroundedReply = config.aiMode === "wordpress"
        ? { response: teamHandoffMessage, shouldEscalate: true }
        : await generateBotResponse(
        activeConv.id,
        waNumber,
        content,
        savedMsg?.id
      );
      if (reply.evidenceSlugs && !await areToursAllowed(reply.evidenceSlugs)) {
        reply.response = "This trip is no longer available in our selected website information. I'll connect you with the Tripanza team.";
        reply.shouldEscalate = true;
        reply.media = undefined;
        reply.selectedTour = undefined;
      }
      const { response, shouldEscalate } = reply;

      // An agent may claim the chat while the provider is still generating.
      const latest = await getConversation(activeConv.id);
      if (!latest || latest.status !== "bot" || latest.claimed_by || latest.ai_paused || latest.ai_revision !== aiState.ai_revision || !response.trim()) return true;
      const sent = await sendWaMessage(jid, { text: response });
      const botMsg = await addMessage({
        conversationId: activeConv.id,
        sender: "bot",
        content: response,
        waMessageId: sent?.key?.id || undefined,
        contentType: "text",
      });


      if (botMsg) {
        broadcast("conversation:message", {
          conversationId: activeConv.id,
          message: botMsg,
        });
      }
      if (reply.selectedTour) await rememberTour(customer.id, reply.selectedTour, { id: activeConv.id, revision: aiState.ai_revision });
      if (!shouldEscalate && reply.media?.length) await deliverWebsiteMedia(activeConv.id, jid, reply.media, reply.evidenceSlugs, aiState.ai_revision);

      if (shouldEscalate) {
        const changed = await db.update(schema.conversations)
          .set({ status: "waiting", updated_at: new Date().toISOString() })
          .where(and(eq(schema.conversations.id, activeConv.id), eq(schema.conversations.status, "bot"), isNull(schema.conversations.claimed_by), eq(schema.conversations.ai_paused, false), eq(schema.conversations.ai_revision, aiState.ai_revision)));
        if ((changed as { rowsAffected?: number }).rowsAffected === 0) return true;
        activeConv.status = "waiting";

        broadcast("conversation:status", {
          conversationId: activeConv.id,
          status: "waiting",
        });

        broadcast("conversation:new", {
          id: activeConv.id,
          wa_number: waNumber,
          customer_name: pushName,
          status: "waiting",
          claimed_by: null,
          updated_at: new Date().toISOString(),
        });

        await emitQueueCount();
        requestDashboardBroadcast();

        sendNotificationToAllCs({
          title: `${pushName} is waiting for an agent`,
          body: content ? content.substring(0, 100) : "New customer in the queue",
          url: `/cs/${activeConv.id}`,
          tag: "new-queue",
        }).catch((err) => logger.error("[notif] Failed:", err));

        notifyEscalation(pushName, waNumber, activeConv.id).catch(
          (err: unknown) => logger.error("[orchestrator] Failed to send escalation notif:", err)
        );
      }
    } else if (activeConv.status === "waiting") {
      // customer sends another message while waiting
      if (activeConv.claimed_by) {
        await sendNotificationToUser(activeConv.claimed_by, {
          title: `${pushName}`,
          body: content ? content.substring(0, 100) : "New message in the waiting queue",
          url: `/cs/${activeConv.id}`,
          tag: `conv-${activeConv.id}`,
        });
      }
    }
  }
  return true;
}

function extractMessageText(msg: proto.IWebMessageInfo): string | null {
  return incomingText(msg) || null;
}

function getMessageContentType(msg: proto.IWebMessageInfo): string {
  const m = msg.message;
  if (!m) return "text";
  if (m.imageMessage) return "image";
  if (m.videoMessage) return "video";
  if (m.documentMessage) return "document";
  if (m.audioMessage) return "document";
  return "text";
}

const UPLOAD_DIR = config.uploadDir;

async function saveMediaBuffer(
  buffer: Buffer,
  mediaType: string
): Promise<string> {
  // Ensure upload directory exists
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  const ext = mediaType === "imageMessage" ? "jpg" : mediaType === "videoMessage" ? "mp4" : "bin";
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = join(UPLOAD_DIR, id);
  writeFileSync(filePath, buffer);
  return `/uploads/${id}`;
}

// Expose for conversation resolve flow
export async function generateAndSaveSummary(
  conversationId: string,
  customerId: string
): Promise<string> {
  const initial = await getConversation(conversationId);
  if (!initial) return "";
  const [memoryBefore] = await db.select({ reset: schema.customerMemory.reset_at }).from(schema.customerMemory).where(eq(schema.customerMemory.customer_id, customerId));
  const { messages } = await getMessages({
    conversationId,
    limit: 100,
  });

  const summary = await generateSummary(
    messages.reverse().map((m) => ({ sender: m.sender, content: m.content }))
  );

  await db.transaction(async tx => {
    const [chat] = await tx.select({ revision: schema.conversations.ai_revision }).from(schema.conversations).where(eq(schema.conversations.id, conversationId));
    const [memoryAfter] = await tx.select({ reset: schema.customerMemory.reset_at }).from(schema.customerMemory).where(eq(schema.customerMemory.customer_id, customerId));
    if (!chat || chat.revision !== initial.ai_revision || (memoryAfter?.reset || null) !== (memoryBefore?.reset || null)) return;
    await tx.update(schema.customers).set({ last_summary: summary, summary_updated_at: new Date().toISOString() }).where(eq(schema.customers.id, customerId));
  });

  return summary;
}

// Serialize each customer's messages so concurrent deliveries cannot create
// duplicate sessions or let the AI answer while an agent owns the conversation.
const pendingMessages = new Map<string, Promise<boolean>>();
export async function handleIncomingMessage(msg: proto.IWebMessageInfo): Promise<boolean> {
  const jid = msg.key?.remoteJid;
  if (!jid || jid === "status@broadcast") return true;
  if (msg.key?.fromMe) {
    await recordOutgoingMessage(jid, { text: extractMessageText(msg) || "" }, msg, "cs");
    return false;
  }
  const customerKey = (msg.key as any)?.senderPn || jid;
  const previous = pendingMessages.get(customerKey) || Promise.resolve(true);
  const current = previous.catch(() => true).then(() => processIncomingMessage(msg));
  pendingMessages.set(customerKey, current);
  try { return await current; }
  finally { if (pendingMessages.get(customerKey) === current) pendingMessages.delete(customerKey); }
}

export async function recordOutgoingMessage(jid: string, content: Record<string, any>, sent: proto.IWebMessageInfo, sender: "bot" | "cs" = "bot") {
  if (!sent?.key?.id || jid.includes("@g.us")) return;
  const existing = await db.select().from(schema.messages).where(eq(schema.messages.wa_message_id, sent.key.id)).limit(1);
  if (existing.length) return;
  const customers = await db.select().from(schema.customers).where(eq(schema.customers.jid, jid)).limit(1);
  if (!customers[0]) return;
  const conversation = await findActiveConversation(customers[0].id);
  if (!conversation) return;
  const contentType = content.image ? "image" : content.video ? "video" : content.document ? "document" : "text";
  const attachment = content.image || content.video || content.document;
  const message = await addMessage({
    conversationId: conversation.id, sender,
    content: content.text || content.caption || "", contentType,
    mediaUrl: typeof attachment?.url === "string" ? attachment.url : undefined,
    fileName: content.fileName, waMessageId: sent.key.id,
  });
  broadcast("conversation:message", { conversationId: conversation.id, message });
  requestDashboardBroadcast();
}
