import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { syncWebsite, websiteStatus, getTour, saveWebsiteSources, WebsiteSourceError } from "../services/website.js";
import { db, schema } from "../db/index.js";
import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";

function startSync() { syncWebsite().catch(() => logger.warn("[website] Selected-tour indexing failed; check Website Knowledge.")); }

const router = Router();
router.use(authenticate, requireRole("super_admin", "admin"));
router.get("/", async (_req, res) => { try { res.json(await websiteStatus()); } catch { res.status(500).json({ error: "Website status unavailable" }); } });
router.post("/sync", async (req, res) => {
  try {
    startSync();
    await db.insert(schema.auditLog).values({ id: randomUUID(), user_id: (req as any).user.sub, action: "website_sync", entity_type: "website", created_at: new Date().toISOString() });
    res.status(202).json(await websiteStatus());
  } catch { res.status(502).json({ error: "Website synchronization failed. Check the website status for details." }); }
});
router.put("/sources", async (req, res) => {
  try {
    await saveWebsiteSources(req.body?.urls);
    await db.insert(schema.auditLog).values({ id: randomUUID(), user_id: (req as any).user.sub, action: "website_sources_update", entity_type: "website", created_at: new Date().toISOString() });
    startSync();
    res.status(202).json(await websiteStatus());
  } catch (error) {
    if (error instanceof WebsiteSourceError) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: "Could not save tour links. Please try again." });
  }
});
router.get("/tours/:slug", async (req, res) => {
  try { res.json(await getTour(String(req.params.slug))); }
  catch { res.status(502).json({ error: "Could not verify this tour on the website" }); }
});
export default router;
