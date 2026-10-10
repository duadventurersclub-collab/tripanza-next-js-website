import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";
import { fetchSite, areToursAllowed, type SiteAsset } from "./website.js";
import { sendWaMessage } from "./waGateway.js";
import { addMessage, getConversation } from "./conversation.js";
import { broadcast } from "../ws/index.js";
import { logger } from "../utils/logger.js";
import { crmAutoRepliesAllowed } from "./crmReplyControls.js";

async function botOwns(id: string, revision?: number) { if (!await crmAutoRepliesAllowed()) return false; const chat = await getConversation(id); return !!chat && chat.status === "bot" && !chat.claimed_by && !chat.ai_paused && (revision === undefined || chat.ai_revision === revision); }
export async function deliverWebsiteMedia(conversationId: string, jid: string, assets: SiteAsset[], evidenceSlugs: string[] = [], revision?: number) {
  const canDeliver = async () => await botOwns(conversationId, revision) && await areToursAllowed(evidenceSlugs);
  for (const asset of assets.slice(0, 6)) {
    if (!await canDeliver()) return;
    let filename: string | null = null;
    let accepted = false;
    try {
      const purpose = asset.kind === "document" && asset.url.includes("generate_pdf=1") ? "pdf" : "media";
      const file = await fetchSite(asset.url, purpose, asset.kind === "image" ? 10 * 1024 * 1024 : 25 * 1024 * 1024);
      let buffer: Buffer = file.buffer; let mime = file.mime;
      if (asset.kind === "image") {
        if (!mime.startsWith("image/")) throw new Error("Website did not return an image");
        buffer = await sharp(buffer, { limitInputPixels: 40000000 }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
        mime = "image/jpeg";
      } else if (asset.kind === "video" && mime !== "video/mp4" && mime !== "video/webm") throw new Error("Website did not return a video");
      else if (asset.kind === "document" && mime !== "application/pdf") throw new Error("Website did not return a PDF");
      if (!await canDeliver()) return;
      const documentVideo = mime === "video/webm";
      const contentType = documentVideo ? "document" : asset.kind;
      const ext = mime === "image/jpeg" ? "jpg" : mime === "application/pdf" ? "pdf" : documentVideo ? "webm" : "mp4";
      const localName = `${randomUUID()}.${ext}`;
      filename = join(config.uploadDir, localName);
      await mkdir(config.uploadDir, { recursive: true }); await writeFile(filename, buffer);
      if (!await canDeliver()) { await unlink(filename).catch(() => undefined); return; }
      const content: any = { [contentType]: buffer, mimetype: mime, caption: asset.caption };
      if (contentType === "document") content.fileName = asset.fileName;
      const sent = await sendWaMessage(jid, content);
      accepted = true;
      const saved = await addMessage({ conversationId, sender: "bot", content: asset.caption, contentType, mediaUrl: `/uploads/${localName}`, mediaType: mime, fileName: contentType === "image" ? `${asset.fileName.replace(/\.[^.]+$/, "")}.jpg` : asset.fileName, fileSize: buffer.length, waMessageId: sent?.key?.id || undefined });
      broadcast("conversation:message", { conversationId, message: saved });
      filename = null;
    } catch (error) {
      if (filename && !accepted) await unlink(filename).catch(() => undefined);
      logger.warn("[website] Media delivery failed:", error instanceof Error ? error.message : "Unknown error");
      if (accepted) return; // Never resend an attachment that WhatsApp already accepted.
      if (!await canDeliver()) return;
      const text = `I couldn't attach this file. You can open it on the Tripanza website:\n${asset.caption.split("\n")[0]}\n${asset.url}`;
      try {
        const sent = await sendWaMessage(jid, { text });
        const saved = await addMessage({ conversationId, sender: "bot", content: text, waMessageId: sent?.key?.id || undefined });
        broadcast("conversation:message", { conversationId, message: saved });
      } catch { return; }
      // One failure is enough; avoid repeatedly sending failure messages for a gallery.
      return;
    }
  }
}
