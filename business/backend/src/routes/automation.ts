import { Router, raw, type RequestHandler } from "express";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth.js";
import { adminMutationRateLimit } from "../middleware/rateLimit.js";
import { createAuditLog } from "../utils/audit.js";
import * as automation from "../services/automation.js";
import { config } from "../config.js";

export const cloudHooks = Router();
cloudHooks.get("/:id", async (req, res) => {
  try {
    if (req.query["hub.mode"] !== "subscribe" || !await automation.verifyCloudWebhook(String(req.params.id), String(req.query["hub.verify_token"] || ""))) { res.sendStatus(403); return; }
    res.type("text/plain").send(String(req.query["hub.challenge"] || ""));
  } catch { res.sendStatus(403); }
});
cloudHooks.post("/:id", raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  try { await automation.acceptCloudWebhook(String(req.params.id), req.body, String(req.headers["x-hub-signature-256"] || "")); res.sendStatus(200); }
  catch { res.sendStatus(403); }
});
const router = Router();
router.use(async (req: AuthRequest, res, next) => {
  const token = req.headers["x-api-key"];
  if (typeof token !== "string") { authenticate(req, res, next); return; }
  try {
    const user = await automation.apiKeyUser(token);
    if (!user) { res.status(401).json({ error: "Invalid or revoked automation API key" }); return; }
    req.user = { sub: user.id, role: "admin" }; next();
  } catch { res.status(401).json({ error: "Invalid automation API key" }); }
});
router.use(requireRole("admin", "super_admin"));
router.use((req, res, next) => {
  if (!config.rateLimitEnabled || ["GET", "HEAD"].includes(req.method)) next();
  else adminMutationRateLimit(req, res, next);
});
const endpoint = (handler: (req: AuthRequest) => Promise<any>, mutation?: string): RequestHandler => async (req: AuthRequest, res) => {
  try {
    const data = await handler(req);
    if (mutation) await createAuditLog({ userId: req.user!.sub, action: mutation, entityType: "automation" });
    res.json(data ?? { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    // Expose our validation messages only. Never leak upstream/raw errors.
    const allowed = /^(Enter|Choose|Use |Up to|Account not found|Campaign not found|Rule not found|Item not found|Webhook not found|Unknown account|Unknown campaign|Meta accounts|Meta connection|Group management|Group controls|Account controls|Private network)/.test(message);
    res.status(400).json({ error: allowed ? message : "Action failed. Check the account connection and try again." });
  }
};
router.get("/overview", endpoint(async () => ({ accounts: await automation.accounts(), campaigns: await automation.campaignSummaries(), rules: await automation.listRecords("rule"),
  webhooks: (await automation.listRecords("webhook")).map(({ secret, ...item }) => ({ ...item, secretConfigured: !!secret })), buttons: await automation.buttonSettings(), jobs: await automation.listJobs(), events: await automation.listEvents() })));
router.get("/accounts", endpoint(automation.accounts));
router.post("/accounts", requireRole("super_admin"), endpoint(req => automation.saveAccount(req.body).then(id => ({ id })), "create_whatsapp_account"));
router.put("/accounts/:id", requireRole("super_admin"), endpoint(req => automation.saveAccount(req.body, String(req.params.id)).then(id => ({ id })), "update_whatsapp_account"));
router.delete("/accounts/:id", requireRole("super_admin"), endpoint(req => automation.deleteRecord(String(req.params.id), "account"), "delete_whatsapp_account"));
router.post("/accounts/:id/:action", requireRole("super_admin"), endpoint(req => automation.accountAction(String(req.params.id), String(req.params.action)), "whatsapp_account_action"));
router.post("/campaigns", endpoint(req => automation.createJobs(req.body), "create_message_campaign"));
router.post("/campaigns/:id/:action", endpoint(req => automation.campaignAction(String(req.params.id), String(req.params.action)), "message_campaign_action"));
router.get("/jobs", endpoint(async req => {
  let cursor;
  if (typeof req.query.cursor === "string") {
    cursor = JSON.parse(Buffer.from(req.query.cursor, "base64url").toString());
    if (typeof cursor?.createdAt !== "string" || typeof cursor?.id !== "string" || cursor.id.length > 40 || cursor.createdAt.length > 40) throw new Error("Choose a valid page cursor");
  }
  const rows = await automation.listJobs(typeof req.query.campaignId === "string" ? req.query.campaignId : undefined, cursor);
  const last = rows.at(-1);
  return { jobs: rows, nextCursor: rows.length === 100 && last ? Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString("base64url") : null };
}));
router.get("/events", endpoint(req => automation.listEvents(typeof req.query.gatewayId === "string" ? req.query.gatewayId : undefined)));
router.post("/rules", endpoint(req => automation.saveRule(req.body).then(id => ({ id })), "create_keyword_rule"));
router.put("/rules/:id", endpoint(req => automation.saveRule(req.body, String(req.params.id)).then(id => ({ id })), "update_keyword_rule"));
router.delete("/rules/:id", endpoint(req => automation.deleteRecord(String(req.params.id), "rule"), "delete_keyword_rule"));
router.post("/groups/:account/:action", endpoint(req => automation.groupAction(String(req.params.account), String(req.params.action), req.body || {}), "whatsapp_group_action"));
router.post("/webhooks", requireRole("super_admin"), endpoint(req => automation.saveWebhook(req.body).then(id => ({ id })), "create_webhook"));
router.put("/webhooks/:id", requireRole("super_admin"), endpoint(req => automation.saveWebhook(req.body, String(req.params.id)).then(id => ({ id })), "update_webhook"));
router.delete("/webhooks/:id", requireRole("super_admin"), endpoint(req => automation.deleteRecord(String(req.params.id), "webhook"), "delete_webhook"));
router.put("/buttons", endpoint(req => automation.buttonSettings(req.body), "update_button_mode"));
router.get("/api-keys", requireRole("super_admin"), endpoint(async () => (await automation.listRecords("api-key")).map(({ hash, ...value }) => value)));
router.post("/api-keys", requireRole("super_admin"), endpoint(req => automation.createApiKey(req.body.name, req.user!.sub), "create_automation_api_key"));
router.delete("/api-keys/:id", requireRole("super_admin"), endpoint(req => automation.deleteRecord(String(req.params.id), "api-key"), "revoke_automation_api_key"));
export default router;
