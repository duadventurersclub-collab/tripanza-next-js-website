import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { config } from "../config.js";
import { canGenerateReply } from "./conversationControls.js";

export async function readMemory(customerId: string) {
  const row = (await db.select().from(schema.customerMemory).where(eq(schema.customerMemory.customer_id, customerId)).limit(1))[0];
  if (!row) return { selectedTour: null as string | null, notes: [] as string[], preferences: {} as Record<string, string>, resetAt: null as string | null };
  if (Date.now() - Date.parse(row.updated_at) > config.contextExpiryDays * 86400000) {
    await clearMemory(customerId);
    return { selectedTour: null, notes: [], preferences: {}, resetAt: new Date().toISOString() };
  }
  let notes: string[] = []; try { notes = JSON.parse(row.customer_notes); } catch { /* discard corrupt memory */ }
  let preferences: Record<string, string> = {}; try { preferences = JSON.parse(row.preferences_json); } catch { /* discard corrupt preferences */ }
  return { selectedTour: row.selected_tour, notes: Array.isArray(notes) ? notes.filter(n => typeof n === "string").slice(-48) : [], preferences, resetAt: row.reset_at };
}
export async function rememberCustomerMessage(customerId: string, message: string) {
  const memory = await readMemory(customerId);
  // Save the customer's own words, never inferred dates, budgets, or AI-generated facts.
  const notes = [...memory.notes, message.slice(0, 700)].slice(-48);
  while (notes.join("\n").length > 12000) notes.shift();
  await db.insert(schema.customerMemory).values({ customer_id: customerId, selected_tour: memory.selectedTour, customer_notes: JSON.stringify(notes), updated_at: new Date().toISOString(), reset_at: memory.resetAt }).onConflictDoUpdate({ target: schema.customerMemory.customer_id, set: { customer_notes: JSON.stringify(notes), updated_at: new Date().toISOString() } });
}
export async function rememberTour(customerId: string, slug: string, guard?: { id: string; revision: number }) {
  return db.transaction(async () => {
    if (guard && !await canGenerateReply(guard.id, guard.revision)) return;
    await db.insert(schema.customerMemory).values({ customer_id: customerId, selected_tour: slug, customer_notes: "[]", updated_at: new Date().toISOString() }).onConflictDoUpdate({ target: schema.customerMemory.customer_id, set: { selected_tour: slug, updated_at: new Date().toISOString() } });
  });
}
export async function rememberPreferences(customerId: string, values: Record<string, string>, customerMessage: string, guard?: { id: string; revision: number }) {
  return db.transaction(async () => {
  if (guard && !await canGenerateReply(guard.id, guard.revision)) throw new Error("Conversation no longer permits this reply");
  const memory = await readMemory(customerId);
  const allowed = ["dates", "budget", "travellers", "room_sharing", "pickup", "interests", "destination", "trip_type", "accommodation", "transport", "name", "email"];
  const updated = { ...memory.preferences };
  for (const [key, value] of Object.entries(values)) {
    // A saved preference must quote the customer's current words exactly; no guesses or assistant-derived claims.
    if (!allowed.includes(key) || typeof value !== "string" || !value.trim() || value.length > 250 || !customerMessage.includes(value)) throw new Error("Preference is not supported by the customer's message");
    updated[key] = value;
  }
  await db.insert(schema.customerMemory).values({ customer_id: customerId, preferences_json: JSON.stringify(updated), updated_at: new Date().toISOString() }).onConflictDoUpdate({ target: schema.customerMemory.customer_id, set: { preferences_json: JSON.stringify(updated), updated_at: new Date().toISOString() } });
  });
}
export async function clearMemory(customerId: string) {
  const now = new Date().toISOString();
  await db.insert(schema.customerMemory).values({ customer_id: customerId, customer_notes: "[]", updated_at: now, reset_at: now }).onConflictDoUpdate({ target: schema.customerMemory.customer_id, set: { selected_tour: null, customer_notes: "[]", preferences_json: "{}", updated_at: now, reset_at: now } });
  await db.update(schema.customers).set({ last_summary: null, summary_updated_at: null }).where(eq(schema.customers.id, customerId));
}
