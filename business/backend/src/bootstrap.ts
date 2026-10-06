import { db, schema } from "./db/index.js";
import { generateId } from "./utils/id.js";
import { hashPassword } from "./services/auth.js";

export async function bootstrapWorkspace() {
  const now = new Date().toISOString();
  if (!(await db.select().from(schema.users).limit(1)).length) {
    const email = process.env.BUSINESS_ADMIN_EMAIL;
    const password = process.env.BUSINESS_ADMIN_PASSWORD;
    if (!email || !password || password.length < 12) throw new Error("Set BUSINESS_ADMIN_EMAIL and BUSINESS_ADMIN_PASSWORD (at least 12 characters) to create the first workspace administrator.");
    await db.insert(schema.users).values({
      id: generateId(), name: "Tripanza Admin", email,
      password_hash: await hashPassword(password), role: "super_admin", is_active: true, created_at: now,
    });
  }
  if (!(await db.select().from(schema.botConfig).limit(1)).length) {
    await db.insert(schema.botConfig).values({
      id: generateId(), persona_name: "Kanika",
      system_prompt: "You are Kanika, Tripanza's friendly AI travel assistant. Chat naturally on WhatsApp in the customer's language, including Hindi or Hinglish. Answer the latest message in context, without repeating your introduction or questions already answered. Keep replies warm and brief; ask at most one useful question when needed. Use verified trip information, never invent prices, availability, bookings or payment confirmations. If a customer asks for a person or needs information that cannot be verified, offer team help.",
      business_info: "Tripanza provides travel experiences and itineraries.",
      escalation_keywords: "#chatcs,human agent,talk to a person,manager,supervisor,complaint",
      session_timeout_mins: 30, session_timeout_warning_mins: 5, auto_close_enabled: false, updated_at: now,
    });
  }
  if (!(await db.select().from(schema.stockConfig).limit(1)).length) {
    await db.insert(schema.stockConfig).values({ id: generateId(), source_type: null, config_json: null, is_active: false, updated_at: now });
  }
}
