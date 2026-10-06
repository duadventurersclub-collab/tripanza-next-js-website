// Uses Tripanza's existing CRM connection. This module never creates a third bot.
import { EventEmitter } from "node:events";
import type { AnyMessageContent, WAMessage, proto } from "@whiskeysockets/baileys";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

export interface GatewayAdapter {
  status(): Promise<{ status: "disconnected" | "connecting" | "connected"; qr: string | null }>;
  send(jid: string, content: AnyMessageContent, options?: unknown): Promise<proto.WebMessageInfo | null>;
  download(msg: WAMessage): Promise<Buffer | null>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  accountStatus?(id: string): Promise<{ status: string; qr: string | null }>;
  accountAction?(id: string, action: "connect" | "pause" | "logout" | "remove"): Promise<void>;
  accountSend?(id: string, jid: string, content: Record<string, any>): Promise<proto.IWebMessageInfo>;
  groupAction?(id: string, action: string, data: Record<string, any>): Promise<any>;
}
export const waEvents = new EventEmitter();
let adapter: GatewayAdapter | null = null;
let status: { status: "disconnected" | "connecting" | "connected"; qr: string | null } = { status: "disconnected", qr: null };
export function setGatewayAdapter(value: GatewayAdapter) { adapter = value; }
export function getGatewayAdapter() { return adapter; }
export function getConnectionStatus() { return status; }
export async function refreshGatewayStatus() {
  if (!adapter) return status;
  const next = await adapter.status();
  if (status.status !== next.status) waEvents.emit("status", next.status);
  status = next;
  return status;
}
export async function connectWa() {
  if (!adapter) throw new Error("CRM gateway is unavailable");
  await adapter.connect(); await refreshGatewayStatus();
}
export async function disconnectWa() {
  if (!adapter) throw new Error("CRM gateway is unavailable");
  await adapter.disconnect(); await refreshGatewayStatus();
}
export async function sendWaMessage(jid: string, content: AnyMessageContent, options?: unknown): Promise<proto.WebMessageInfo | null> {
  if (!adapter) throw new Error("CRM gateway is unavailable");
  let target = jid;
  if (!jid.includes("@")) {
    const rows = await db.select().from(schema.customers).where(eq(schema.customers.wa_number, jid)).limit(1);
    target = rows[0]?.jid || getJid(jid);
  }
  const { decorateButtons } = await import("./automation.js");
  const decorated = options ? content : await decorateButtons(content);
  const result = (decorated as any).__interactiveButtons && adapter.accountSend
    ? await adapter.accountSend("crm", target, decorated) : await adapter.send(target, content, options);
  if (!result) throw new Error("WhatsApp did not accept the message");
  return result as proto.WebMessageInfo;
}
export async function downloadWaMedia(msg: WAMessage): Promise<Buffer | null> { return adapter ? adapter.download(msg) : null; }
export function getJid(number: string) { return `${number.replace(/\D/g, "")}@s.whatsapp.net`; }
export function extractWaNumber(jid: string) { return jid.split("@")[0].split(":")[0].replace(/\D/g, ""); }
