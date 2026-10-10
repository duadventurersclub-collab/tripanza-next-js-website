import { Router, type Response, type NextFunction } from "express";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth.js";
import { requestDashboardBroadcast } from "../services/dashboard.js";
import {
  getConversations,
  getMessages,
  getConversation,
  addMessage,
  claimConversation,
  transferConversation,
  resolveConversation,
  getQueueCount,
  getNotesByWaNumber,
  updateConversationNote,
  type ConversationStatus,
} from "../services/conversation.js";
import { sendWaMessage } from "../services/waGateway.js";
import { emitToUser, emitToRole, broadcast, getActiveUserIds } from "../ws/index.js";
import { generateAndSaveSummary } from "../services/orchestrator.js";
import { logger } from "../utils/logger.js";
import { sendNotificationToUser } from "../services/notifications.js";
import { getCsConfig } from "../services/csConfig.js";
import { notifyClaim, notifyResolve, notifyReactivate } from "../services/waGroupNotif.js";
import { createAuditLog } from "../utils/audit.js";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { config } from "../config.js";
import { setConversationAi, deleteWorkspaceConversation, ConversationControlError } from "../services/conversationControls.js";
import { crmAutoRepliesAllowed } from "../services/crmReplyControls.js";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

const router = Router();

router.use(authenticate);

function getUser(req: AuthRequest): { sub: string; role: string } {
  if (!req.user) throw new Error("Not authenticated");
  return req.user;
}

type ConversationWithName = NonNullable<Awaited<ReturnType<typeof getConversation>>>;

async function requireConversationAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const user = getUser(req);
    const conv = await getConversation(id);
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
    (req as unknown as { conversation: ConversationWithName }).conversation = conv;
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/cs-config", async (_req, res) => {
  try {
    const config = await getCsConfig();
    res.json(config);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/agents", async (_req, res) => {
  try {
    const online = new Set(getActiveUserIds());
    const users = await db.select({ id: schema.users.id, name: schema.users.name, role: schema.users.role }).from(schema.users).where(eq(schema.users.is_active, true));
    res.json(users.map(user => ({ ...user, is_online: online.has(user.id) })));
  } catch { res.status(500).json({ error: "Could not load team members" }); }
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const { status, cursor, limit, claimed_by } = req.query;
    let resolvedClaimedBy = claimed_by as string | undefined;
    if (resolvedClaimedBy === "me" && req.user) {
      resolvedClaimedBy = req.user.sub;
    }
    const result = await getConversations({
      cursor: cursor as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      status: status as ConversationStatus | undefined,
      claimedBy: resolvedClaimedBy,
    });
    res.json(result);
  } catch (err) {
    logger.error("[conversations] List error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/queue-count", async (_req, res) => {
  try {
    const count = await getQueueCount();
    res.json({ count });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireConversationAccess, async (req: AuthRequest, res: Response) => {
  const conv = (req as unknown as { conversation: ConversationWithName }).conversation;
  res.json(conv);
});

router.put("/:id/ai", async (req: AuthRequest, res) => {
  if (!req.body || typeof req.body.paused !== "boolean" || Object.keys(req.body).some(k => k !== "paused")) { res.status(400).json({ error: "paused must be true or false" }); return; }
  try {
    const chat = await setConversationAi(String(req.params.id), req.body.paused, getUser(req));
    broadcast("conversation:ai", { conversationId: chat.id, paused: chat.ai_paused, revision: chat.ai_revision, status: chat.status, claimedBy: chat.claimed_by });
    broadcast("conversation:status", { conversationId: chat.id, status: chat.status, claimedBy: chat.claimed_by });
    broadcast("queue:update", { count: await getQueueCount() }); requestDashboardBroadcast();
    await createAuditLog({ userId: req.user!.sub, action: chat.ai_paused ? "pause_ai_replies" : "resume_ai_replies", entityType: "conversations", entityId: chat.id });
    res.json(chat);
  } catch (error) {
    res.status(error instanceof ConversationControlError ? error.status : 500).json({ error: error instanceof ConversationControlError ? error.message : "Could not update AI replies" });
  }
});
router.delete("/:id", requireRole("super_admin", "admin"), async (req: AuthRequest, res) => {
  try {
    const chat = await deleteWorkspaceConversation(String(req.params.id));
    broadcast("conversation:deleted", { conversationId: chat.id });
    broadcast("queue:update", { count: await getQueueCount() }); requestDashboardBroadcast();
    await createAuditLog({ userId: req.user!.sub, action: "delete_conversation", entityType: "conversations", entityId: chat.id });
    res.json({ deleted: true, conversationId: chat.id });
  } catch (error) {
    res.status(error instanceof ConversationControlError ? error.status : 500).json({ error: error instanceof ConversationControlError ? error.message : "Could not delete this chat" });
  }
});

router.get("/:id/messages", requireConversationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { cursor, limit } = req.query;
    const result = await getMessages({
      conversationId: id,
      cursor: cursor as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      direction: "older",
    });
    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/messages", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = getUser(req);
    const { content, contentType, mediaUrl, fileData, fileName, quotedMessageId } = req.body as Record<string, unknown>;
    if (contentType && !["text", "image", "video", "document"].includes(String(contentType))) { res.status(400).json({ error: "Unsupported message type" }); return; }
    if (content !== undefined && (typeof content !== "string" || content.length > 4000)) { res.status(400).json({ error: "Message must be text of at most 4000 characters" }); return; }
    if (!content && !fileData && !mediaUrl) { res.status(400).json({ error: "Message or attachment is required" }); return; }
    if (mediaUrl && (typeof mediaUrl !== "string" || !/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(mediaUrl))) { res.status(400).json({ error: "Use a workspace attachment" }); return; }
    const conv = await getConversation(id);
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
    let convStatus = conv.status;
    let convClaimedBy = conv.claimed_by;

    if (convStatus === "resolved") {
      const now = new Date().toISOString();
      await db
        .update(schema.conversations)
        .set({ status: "active", claimed_by: user.sub, updated_at: now })
        .where(eq(schema.conversations.id, id));

      broadcast("conversation:claimed", { conversationId: id, claimedBy: user.sub, status: "active" });
      broadcast("conversation:status", { conversationId: id, status: "active", claimedBy: user.sub });
      requestDashboardBroadcast();

      createAuditLog({
        userId: user.sub,
        action: "reactivate_conversation",
        entityType: "conversations",
        entityId: id,
        details: JSON.stringify({ customer: conv.customer_name || conv.wa_number }),
      });

      const csUserRows = await db.select().from(schema.users).where(eq(schema.users.id, user.sub)).limit(1);
      const csUser = csUserRows[0];
      const csName = csUser?.name || "CS";
      notifyReactivate(conv.customer_name || conv.wa_number, csName, id).catch((err) =>
        logger.warn("[conversations] Reactivate notification failed:", err)
      );

      convStatus = "active";
      convClaimedBy = user.sub;
    }

    if (user.role === "cs" && convClaimedBy !== user.sub && convStatus !== "waiting" && convStatus !== "bot") {
      res.status(403).json({ error: "You can only send messages to your claimed conversations" });
      return;
    }

    if (convStatus === "bot" || convStatus === "waiting") {
      const result = await claimConversation(id, user.sub);
      if (!result.claimed && result.conversation.claimed_by !== user.sub) {
        res.status(409).json({ error: "Another agent claimed this conversation" }); return;
      }
    }

    const csUserRows = await db.select().from(schema.users).where(eq(schema.users.id, user.sub)).limit(1);
    const csUser = csUserRows[0];

    let finalContent = content as string | undefined;
    const csConfig = await getCsConfig();
    if (csConfig.signatureEnabled && csConfig.signatureTemplate && csUser && finalContent) {
      const footer = csConfig.signatureTemplate.replace("{name}", csUser.name);
      finalContent = `${finalContent}\n\n${footer}`;
    }

    let savedMediaUrl = mediaUrl as string | undefined;
    let localFilePath: string | null = null;

    if (fileData) {
      let base64Content = fileData as string;
      if (base64Content.startsWith("data:") && base64Content.includes(";base64,")) {
        const parts = base64Content.split(";base64,");
        base64Content = parts[1] || "";
      }

      // Estimate decoded size before allocating (base64 overhead ≈ 1.37×)
      const estimatedSize = Math.ceil(base64Content.length * 0.75);
      if (estimatedSize > MAX_UPLOAD_SIZE) {
        res.status(400).json({ error: "File size exceeds maximum allowed size (10 MB)" });
        return;
      }

      const buffer = Buffer.from(base64Content, "base64");

      if (buffer.length > MAX_UPLOAD_SIZE) {
        res.status(400).json({ error: "File size exceeds maximum allowed size (10 MB)" });
        return;
      }

      const ext = fileName ? (fileName as string).split(".").pop() : "bin";
      const cleanedFileName = fileName ? (fileName as string).replace(/[^a-zA-Z0-9.\-_]/g, "_") : `file_${Date.now()}`;
      const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${cleanedFileName}`;

      const uploadDir = config.uploadDir;
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = join(uploadDir, uniqueName);
      writeFileSync(filePath, buffer);

      savedMediaUrl = `/uploads/${uniqueName}`;
      localFilePath = filePath;
    }

    let replyToContent: string | undefined = undefined;
    let replyToSender: string | undefined = undefined;
    if (quotedMessageId) {
      const qRows = await db
        .select()
        .from(schema.messages)
        .where(and(eq(schema.messages.id, quotedMessageId as string), eq(schema.messages.conversation_id, id)))
        .limit(1);
      if (qRows.length > 0) {
        const qm = qRows[0];
        replyToContent = qm.content || "";
        if (qm.sender === "cs") {
          const qUserRows = await db.select().from(schema.users).where(eq(schema.users.id, qm.cs_id || "")).limit(1);
          replyToSender = qUserRows[0]?.name || "CS";
        } else if (qm.sender === "bot") {
          replyToSender = "Bot";
        } else {
          replyToSender = conv.customer_name || conv.wa_number;
        }
      }
    }

    let sentMessageId: string | undefined;
    try {
      const waContent: Record<string, unknown> = {};
      let mediaPath: string | null = localFilePath;
      if (!mediaPath && savedMediaUrl && savedMediaUrl.startsWith("/uploads/")) {
        const filename = savedMediaUrl.substring("/uploads/".length);
        mediaPath = join(config.uploadDir, filename);
      }

      if (contentType === "image" && savedMediaUrl) {
        waContent.image = { url: mediaPath || savedMediaUrl };
        if (finalContent) waContent.caption = finalContent;
      } else if (contentType === "video" && savedMediaUrl) {
        waContent.video = { url: mediaPath || savedMediaUrl };
        if (finalContent) waContent.caption = finalContent;
      } else if (contentType === "document" && savedMediaUrl) {
        waContent.document = { url: mediaPath || savedMediaUrl };
        if (finalContent) waContent.caption = finalContent;
        waContent.fileName = (fileName as string) || savedMediaUrl.split("/").pop();
      } else {
        waContent.text = finalContent;
      }

      let quotedOption: any = undefined;
      if (quotedMessageId) {
        const quotedRows = await db
          .select()
          .from(schema.messages)
          .where(and(eq(schema.messages.id, quotedMessageId as string), eq(schema.messages.conversation_id, id)))
          .limit(1);
        if (quotedRows.length > 0) {
          const qm = quotedRows[0];
          const fromMe = qm.sender === "cs" || qm.sender === "bot";
          let customerJid: string | null = null;
          const custRows = await db
            .select()
            .from(schema.customers)
            .where(eq(schema.customers.id, conv.customer_id))
            .limit(1);
          if (custRows.length > 0) {
            customerJid = custRows[0].jid;
          }
          quotedOption = {
            key: {
              remoteJid: customerJid || `${conv.wa_number}@s.whatsapp.net`,
              fromMe: fromMe,
              id: qm.wa_message_id || qm.id,
            },
            message: {
              conversation: qm.content || "",
            },
          };
        }
      }

      if (conv.wa_number) {
        const sent = await sendWaMessage(conv.wa_number, waContent as any, quotedOption ? { quoted: quotedOption } : undefined);
        sentMessageId = sent?.key?.id || undefined;
      }
    } catch (waErr) {
      logger.error("[conversations] WA send error:", waErr);
      res.status(503).json({ error: "WhatsApp could not send your message. Check the CRM connection and retry." });
      return;
    }

    const msg = await addMessage({
      conversationId: id, sender: "cs", csId: user.sub,
      content: finalContent,
      contentType: (contentType as "text" | "image" | "video" | "document") || "text",
      mediaUrl: savedMediaUrl, fileName: fileName as string | undefined,
      replyToContent, replyToSender, waMessageId: sentMessageId,
    });

    const messageWithCsName = { ...msg, cs_name: csUser?.name || null };
    broadcast("conversation:message", { conversationId: id, message: messageWithCsName });
    res.status(201).json(messageWithCsName);
  } catch (err) {
    logger.error("[conversations] Message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/claim", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = getUser(req);
    const conv = await getConversation(id);
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
    if (conv.status !== "waiting" && conv.status !== "bot") {
      res.status(400).json({ error: "Only waiting or bot conversations can be claimed" });
      return;
    }

    const { conversation: updated, claimed } = await claimConversation(id, user.sub);

    // Lost the atomic race — another CS claimed it first. Report the conflict
    // instead of a false success so the UI can refresh to the real owner.
    if (!claimed) {
      res.status(409).json({
        error: "Another agent already claimed this conversation",
        conversation: updated,
      });
      return;
    }

    broadcast("conversation:claimed", { conversationId: id, claimedBy: user.sub, status: "active" });
    broadcast("conversation:status", { conversationId: id, status: "active", claimedBy: user.sub });

    sendNotificationToUser(user.sub, {
      title: "Conversation claimed",
      body: `You claimed the conversation with ${conv.customer_name || conv.wa_number}`,
      tag: `claim-${id}`,
    }).catch((notifErr) => logger.warn("[conversations] Claim notification failed:", notifErr));

    const queueCount = await getQueueCount();
    broadcast("queue:update", { count: queueCount });
    requestDashboardBroadcast();

    const csUserRows = await db.select().from(schema.users).where(eq(schema.users.id, user.sub)).limit(1);
    const csUser = csUserRows[0];
    const csName = csUser?.name || "CS";

    createAuditLog({
      userId: user.sub,
      action: "claim_conversation",
      entityType: "conversations",
      entityId: id,
      details: JSON.stringify({ customer: conv.customer_name || conv.wa_number }),
    });

    notifyClaim(conv.customer_name || conv.wa_number, csName, id).catch(
      (err: unknown) => logger.error("[conversations] Failed to send claim notif:", err)
    );

    const csConfig = await getCsConfig();

    if (csConfig.autoReplyClaimEnabled && csConfig.autoReplyClaim && await crmAutoRepliesAllowed()) {
      const claimMessage = csConfig.autoReplyClaim.replace("{name}", csName);
      try {
        if (conv.wa_number) {
          const sent = await sendWaMessage(conv.wa_number, { text: claimMessage });
          const msg = await addMessage({
            conversationId: id, sender: "cs", csId: user.sub,
            content: claimMessage, contentType: "text", waMessageId: sent?.key?.id || undefined,
          });
          broadcast("conversation:message", { conversationId: id, message: { ...msg, cs_name: csName } });
        }
      } catch (err) {
        logger.error("[conversations] Failed to send auto reply claim:", err);
      }
    }

    res.json(updated);
  } catch (err) {
    logger.error("[conversations] Claim error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/transfer", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = getUser(req);
    const { toCsId } = req.body as Record<string, string>;
    if (!toCsId) { res.status(400).json({ error: "toCsId is required" }); return; }

    const conv = await getConversation(id);
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
    if (conv.claimed_by !== user.sub && user.role === "cs") {
      res.status(403).json({ error: "Only the assigned CS or admin can transfer" });
      return;
    }

    const target = await db.select().from(schema.users).where(eq(schema.users.id, toCsId)).limit(1);
    if (!target[0]?.is_active) { res.status(400).json({ error: "Choose an active team member" }); return; }
    if (!conv.claimed_by) { res.status(400).json({ error: "Claim the conversation before transferring it" }); return; }
    if (!["active", "hold"].includes(conv.status)) { res.status(400).json({ error: "Only an active or held conversation can be transferred" }); return; }
    const updated = await transferConversation(id, conv.claimed_by, toCsId);

    broadcast("conversation:status", { conversationId: id, status: "active", claimedBy: toCsId });
    emitToUser(toCsId, "conversation:transferred", { conversationId: id, from: user.sub, customerName: conv.customer_name || conv.wa_number });
    sendNotificationToUser(toCsId, { title: "Conversation transferred to you", body: `The conversation with ${conv.customer_name || conv.wa_number} is now assigned to you`, url: `/cs/${id}`, tag: "transfer" }).catch(err => logger.warn("[conversations] Transfer notification failed:", err));
    await createAuditLog({ userId: user.sub, action: "transfer_conversation", entityType: "conversations", entityId: id, details: JSON.stringify({ from: conv.claimed_by, to: toCsId }) });
    requestDashboardBroadcast();

    res.json(updated);
  } catch (err) {
    logger.error("[conversations] Transfer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/resolve", requireConversationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = getUser(req);
    const conv = (req as unknown as { conversation: ConversationWithName }).conversation;

    if (user.role === "cs" && conv.claimed_by !== user.sub) {
      res.status(403).json({ error: "Only the assigned agent or an administrator can resolve this conversation" }); return;
    }

    const { rating, review } = req.body as Record<string, unknown>;

    if (rating !== undefined && rating !== null) {
      const ratingNum = Number(rating);
      if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
        return;
      }
    }

    const updated = await resolveConversation(id, rating as number | undefined, review as string | undefined);

    generateAndSaveSummary(id, conv.customer_id).catch((err: unknown) => {
      logger.error("[conversations] Summary generation error:", err);
    });

    broadcast("conversation:status", { conversationId: id, status: "resolved" });
    broadcast("queue:update", { count: await getQueueCount() });

    const csUserRows = await db.select().from(schema.users).where(eq(schema.users.id, user.sub)).limit(1);
    const csUser = csUserRows[0];
    const csName = csUser?.name || "CS";

    createAuditLog({
      userId: user.sub,
      action: "resolve_conversation",
      entityType: "conversations",
      entityId: id,
      details: JSON.stringify({ customer: conv.customer_name || conv.wa_number, rating: rating || null }),
    });

    notifyResolve(conv.customer_name || conv.wa_number, csName, rating as number | null | undefined, id).catch(
      (err: unknown) => logger.error("[conversations] Failed to send resolve notif:", err)
    );

    const csConfig = await getCsConfig();

    if (csConfig.autoReplyResolveEnabled && csConfig.autoReplyResolve && await crmAutoRepliesAllowed()) {
      const resolveMessage = csConfig.autoReplyResolve.replace("{name}", csName);
      try {
        if (conv.wa_number) {
          const sent = await sendWaMessage(conv.wa_number, { text: resolveMessage });
          const msg = await addMessage({
            conversationId: id, sender: "cs", csId: user.sub,
            content: resolveMessage, contentType: "text", waMessageId: sent?.key?.id || undefined,
          });
          broadcast("conversation:message", { conversationId: id, message: { ...msg, cs_name: csName } });
        }
      } catch (err) {
        logger.error("[conversations] Failed to send auto reply resolve:", err);
      }
    }

    res.json(updated);
  } catch (err) {
    logger.error("[conversations] Resolve error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/hold", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = getUser(req);
    const conv = await getConversation(id);
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
    if (conv.status !== "active") {
      res.status(400).json({ error: "Only active conversations can be put on hold" });
      return;
    }
    if (user.role === "cs" && conv.claimed_by !== user.sub) {
      res.status(403).json({ error: "You can only hold your claimed conversations" });
      return;
    }

    const now = new Date().toISOString();
    await db
      .update(schema.conversations)
      .set({ status: "hold", updated_at: now })
      .where(eq(schema.conversations.id, id));

    broadcast("conversation:status", { conversationId: id, status: "hold", claimedBy: conv.claimed_by });
    requestDashboardBroadcast();

    createAuditLog({
      userId: user.sub,
      action: "hold_conversation",
      entityType: "conversations",
      entityId: id,
      details: JSON.stringify({ customer: conv.customer_name || conv.wa_number }),
    });

    res.json({ success: true });
  } catch (err) {
    logger.error("[conversations] Hold error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/unhold", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = getUser(req);
    const conv = await getConversation(id);
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
    if (conv.status !== "hold") {
      res.status(400).json({ error: "Only hold conversations can be activated" });
      return;
    }
    if (user.role === "cs" && conv.claimed_by !== user.sub) {
      res.status(403).json({ error: "You can only activate your claimed conversations" });
      return;
    }

    const now = new Date().toISOString();
    await db
      .update(schema.conversations)
      .set({ status: "active", updated_at: now })
      .where(eq(schema.conversations.id, id));

    broadcast("conversation:status", { conversationId: id, status: "active", claimedBy: conv.claimed_by });
    requestDashboardBroadcast();

    createAuditLog({
      userId: user.sub,
      action: "unhold_conversation",
      entityType: "conversations",
      entityId: id,
      details: JSON.stringify({ customer: conv.customer_name || conv.wa_number }),
    });

    res.json({ success: true });
  } catch (err) {
    logger.error("[conversations] Unhold error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// All notes recorded for a WhatsApp number (history across its conversations).
router.get("/by-number/:wa_number/notes", async (req: AuthRequest, res: Response) => {
  try {
    const waNumber = String(req.params.wa_number || "");
    if (!waNumber || waNumber.length > 30 || /[^0-9+]/.test(waNumber)) {
      res.status(400).json({ error: "Invalid wa_number format" });
      return;
    }
    const notes = await getNotesByWaNumber(waNumber);
    res.json({ notes });
  } catch (err) {
    logger.error("[conversations] Notes fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Edit the note (review) on a conversation at any time, so any CS can record or
// update context the rest of the team can see.
router.patch("/:id/note", requireConversationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = getUser(req);
    const { note } = req.body as Record<string, unknown>;

    if (typeof note !== "string") {
      res.status(400).json({ error: "note must be a string" });
      return;
    }
    if (note.length > 4000) {
      res.status(400).json({ error: "note is too long (max 4000 chars)" });
      return;
    }

    const conv = (req as unknown as { conversation: ConversationWithName }).conversation;
    const updated = await updateConversationNote(id, note);
    if (!updated) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Notify everyone viewing so other CS see the edited note immediately.
    broadcast("note:updated", {
      conversationId: id,
      waNumber: conv.wa_number,
      note,
      editedBy: user.sub,
    });

    createAuditLog({
      userId: user.sub,
      action: "update_note",
      entityType: "conversations",
      entityId: id,
      details: JSON.stringify({ customer: conv.customer_name || conv.wa_number }),
    });

    res.json(updated);
  } catch (err) {
    logger.error("[conversations] Note update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
