import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const automationRecords = sqliteTable("automation_records", {
  id: text("id").primaryKey(), kind: text("kind").notNull(), data: text("data").notNull(), updated_at: text("updated_at").notNull(),
});
export const automationJobs = sqliteTable("automation_jobs", {
  id: text("id").primaryKey(), campaign_id: text("campaign_id"), gateway_id: text("gateway_id").notNull(),
  recipient: text("recipient").notNull(), payload: text("payload").notNull(), state: text("state").notNull(),
  due_at: text("due_at").notNull(), attempts: integer("attempts").notNull().default(0),
  message_id: text("message_id"), error: text("error"), created_at: text("created_at").notNull(), updated_at: text("updated_at").notNull(),
});
export const automationEvents = sqliteTable("automation_events", {
  id: text("id").primaryKey(), gateway_id: text("gateway_id").notNull(), event: text("event").notNull(),
  data: text("data").notNull(), created_at: text("created_at").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: text("role", { enum: ["super_admin", "admin", "cs"] })
    .notNull()
    .default("cs"),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at").notNull(),
});

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  wa_number: text("wa_number").notNull().unique(),
  display_name: text("display_name"),
  total_sessions: integer("total_sessions").notNull().default(0),
  last_conversation_id: text("last_conversation_id"),
  last_summary: text("last_summary"),
  summary_updated_at: text("summary_updated_at"),
  last_active_at: text("last_active_at"),
  created_at: text("created_at").notNull(),
  jid: text("jid"),
});

export const websiteTours = sqliteTable("website_tours", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  catalogue_json: text("catalogue_json").notNull(),
  detail_json: text("detail_json"),
  indexed_at: text("indexed_at").notNull(),
  detail_fetched_at: text("detail_fetched_at"),
});

export const websiteSync = sqliteTable("website_sync", {
  id: text("id").primaryKey(),
  last_success_at: text("last_success_at"),
  last_attempt_at: text("last_attempt_at"),
  error: text("error"),
  selection_revision: integer("selection_revision").notNull().default(0),
});

export const websiteSources = sqliteTable("website_sources", {
  slug: text("slug").primaryKey(),
  url: text("url").notNull(),
  added_at: text("added_at").notNull(),
  error: text("error"),
});

export const privateTripSettings = sqliteTable("private_trip_settings", {
  id: text("id").primaryKey(),
  config_json: text("config_json").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const aiCredentials = sqliteTable("ai_credentials", {
  id: text("id").primaryKey(),
  encrypted_key: text("encrypted_key").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const workspaceActions = sqliteTable("workspace_actions", {
  id: text("id").primaryKey(),
  conversation_id: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  state: text("state").notNull(),
  payload_json: text("payload_json").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const customerMemory = sqliteTable("customer_memory", {
  customer_id: text("customer_id").primaryKey().references(() => customers.id, { onDelete: "cascade" }),
  selected_tour: text("selected_tour"),
  customer_notes: text("customer_notes").notNull().default("[]"),
  preferences_json: text("preferences_json").notNull().default("{}"),
  updated_at: text("updated_at").notNull(),
  reset_at: text("reset_at"),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  customer_id: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  wa_number: text("wa_number").notNull(),
  customer_name: text("customer_name"),
  status: text("status", { enum: ["bot", "waiting", "active", "resolved", "hold"] })
    .notNull()
    .default("bot"),
  claimed_by: text("claimed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  rating: integer("rating"),
  review: text("review"),
  warning_sent: integer("warning_sent", { mode: "boolean" }).notNull().default(false),
  ai_paused: integer("ai_paused", { mode: "boolean" }).notNull().default(false),
  ai_revision: integer("ai_revision").notNull().default(0),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversation_id: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  sender: text("sender", { enum: ["customer", "bot", "cs"] }).notNull(),
  cs_id: text("cs_id").references(() => users.id, { onDelete: "set null" }),
  content: text("content"),
  content_type: text("content_type", {
    enum: ["text", "image", "video", "document"],
  })
    .notNull()
    .default("text"),
  media_url: text("media_url"),
  media_type: text("media_type"),
  file_name: text("file_name"),
  file_size: integer("file_size"),
  wa_message_id: text("wa_message_id"),
  reply_to_content: text("reply_to_content"),
  reply_to_sender: text("reply_to_sender"),
  created_at: text("created_at").notNull(),
}, (table) => ({
  waMessageIdIdx: uniqueIndex("wa_message_id_idx").on(table.wa_message_id),
}));

export const botConfig = sqliteTable("bot_config", {
  id: text("id").primaryKey(),
  persona_name: text("persona_name").notNull().default("Bot AKG"),
  system_prompt: text("system_prompt"),
  business_info: text("business_info"),
  escalation_keywords: text("escalation_keywords"),
  session_timeout_mins: integer("session_timeout_mins").notNull().default(30),
  session_timeout_warning_mins: integer("session_timeout_warning_mins").notNull().default(5),
  auto_close_enabled: integer("auto_close_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  updated_by: text("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updated_at: text("updated_at").notNull(),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  user_agent: text("user_agent"),
  created_at: text("created_at").notNull(),
  last_used_at: text("last_used_at"),
});

export const notificationPreferences = sqliteTable("notification_preferences", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  notif_type: text("notif_type").notNull(),
  is_enabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  dnd_start: text("dnd_start"),
  dnd_end: text("dnd_end"),
});

export const stockConfig = sqliteTable("stock_config", {
  id: text("id").primaryKey(),
  source_type: text("source_type", {
    enum: ["google_sheets", "mysql", "postgresql"],
  }),
  config_json: text("config_json"),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(false),
  updated_at: text("updated_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  user_id: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity_type: text("entity_type"),
  entity_id: text("entity_id"),
  details: text("details"),
  created_at: text("created_at").notNull(),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expires_at: text("expires_at").notNull(),
  created_at: text("created_at").notNull(),
  revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
});

export const revokedAccessTokens = sqliteTable("revoked_access_tokens", {
  token_hash: text("token_hash").primaryKey(),
  expires_at: text("expires_at").notNull(),
});

export const csConfig = sqliteTable("cs_config", {
  id: text("id").primaryKey(),
  signature_enabled: integer("signature_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  signature_template: text("signature_template").notNull().default(" - {name}"),
  quick_replies: text("quick_replies").notNull(),
  auto_reply_claim_enabled: integer("auto_reply_claim_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  auto_reply_claim: text("auto_reply_claim").notNull(),
  auto_reply_resolve_enabled: integer("auto_reply_resolve_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  auto_reply_resolve: text("auto_reply_resolve").notNull(),
  wa_group_notif_enabled: integer("wa_group_notif_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  wa_group_jid: text("wa_group_jid").notNull().default(""),
  updated_at: text("updated_at").notNull(),
});
