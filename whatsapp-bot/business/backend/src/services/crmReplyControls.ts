import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { config } from "../config.js";

export interface CrmReplyControls {
  enabled: boolean; scheduleEnabled: boolean; timezone: string;
  days: number[]; start: string; end: string;
}
const recordId = "crm-reply-controls";
const defaults = (): CrmReplyControls => ({ enabled: true, scheduleEnabled: false, timezone: config.timezone, days: [0, 1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" });
export function validateCrmReplyControls(value: unknown): CrmReplyControls {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter CRM reply settings.");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(key => !["enabled", "scheduleEnabled", "timezone", "days", "start", "end"].includes(key))) throw new Error("Unknown CRM reply setting.");
  if (typeof v.enabled !== "boolean" || typeof v.scheduleEnabled !== "boolean") throw new Error("Choose whether AI replies and their schedule are enabled.");
  if (typeof v.timezone !== "string" || v.timezone.length > 100) throw new Error("Choose a valid timezone.");
  try { new Intl.DateTimeFormat("en", { timeZone: v.timezone }); } catch { throw new Error("Choose a valid timezone, such as Asia/Calcutta."); }
  if (!Array.isArray(v.days) || !v.days.length || v.days.length > 7 || v.days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("Choose at least one day of the week.");
  if (typeof v.start !== "string" || typeof v.end !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.start) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.end) || v.start === v.end) throw new Error("Choose different valid start and end times.");
  return { enabled: v.enabled, scheduleEnabled: v.scheduleEnabled, timezone: v.timezone, days: [...new Set(v.days as number[])].sort(), start: v.start, end: v.end };
}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function crmReplyDecision(settings: CrmReplyControls, now = new Date()) {
  if (!settings.enabled) return { allowed: false, reason: "disabled" as const };
  if (!settings.scheduleEnabled) return { allowed: true, reason: "always_on" as const };
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find(p => p.type === "weekday")!.value);
  const time = Number(parts.find(p => p.type === "hour")!.value) * 60 + Number(parts.find(p => p.type === "minute")!.value);
  const start = minutes(settings.start), end = minutes(settings.end);
  // Selected days refer to when a window starts; an overnight window may end on the next day.
  const allowed = start < end ? settings.days.includes(day) && time >= start && time < end
    : (settings.days.includes(day) && time >= start) || (settings.days.includes((day + 6) % 7) && time < end);
  return { allowed, reason: allowed ? "within_schedule" as const : "outside_schedule" as const };
}
export async function getCrmReplyState(now = new Date()) {
  const [row] = await db.select().from(schema.automationRecords).where(eq(schema.automationRecords.id, recordId)).limit(1);
  const saved = row ? JSON.parse(row.data) : null;
  const settings = saved ? validateCrmReplyControls(saved.settings) : defaults();
  return { settings, revision: saved?.revision || "initial", ...crmReplyDecision(settings, now) };
}
export async function crmAutoRepliesAllowed() { return (await getCrmReplyState()).allowed; }
export async function saveCrmReplyControls(value: unknown) {
  const settings = validateCrmReplyControls(value);
  const data = JSON.stringify({ settings, revision: randomUUID() });
  await db.transaction(async tx => {
    await tx.insert(schema.automationRecords).values({ id: recordId, kind: "crm-reply-controls", data, updated_at: new Date().toISOString() })
      .onConflictDoUpdate({ target: schema.automationRecords.id, set: { data, updated_at: new Date().toISOString() } });
    // Cancel replies/tools already being generated, without releasing any human-owned chat.
    await tx.update(schema.conversations).set({ ai_revision: sql`${schema.conversations.ai_revision} + 1` })
      .where(inArray(schema.conversations.status, ["bot", "waiting", "active", "hold"]));
  });
  return getCrmReplyState();
}
export async function queueCrmHumanConversation(id: string) {
  const [chat] = await db.update(schema.conversations).set({ status: "waiting", ai_revision: sql`${schema.conversations.ai_revision} + 1`, updated_at: new Date().toISOString() })
    .where(and(eq(schema.conversations.id, id), eq(schema.conversations.status, "bot"), isNull(schema.conversations.claimed_by)))
    .returning();
  return chat;
}
