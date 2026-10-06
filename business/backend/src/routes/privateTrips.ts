import { Router } from "express";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth.js";
import { privateTripStatus, savePrivateTripSettings, PrivateTripSettingsError } from "../services/privateTrips.js";
import { createAuditLog } from "../utils/audit.js";
import { adminMutationRateLimit } from "../middleware/rateLimit.js";
import { config } from "../config.js";

const router = Router();
router.use(authenticate, requireRole("super_admin", "admin"));
if (config.rateLimitEnabled) router.use(adminMutationRateLimit);
router.get("/", async (_req, res) => {
  try { res.json(await privateTripStatus()); }
  catch { res.status(500).json({ error: "Could not load private-trip settings." }); }
});
router.put("/", requireRole("super_admin"), async (req: AuthRequest, res) => {
  try {
    const status = await savePrivateTripSettings(req.body);
    await createAuditLog({ userId: req.user!.sub, action: "private_trip_settings_update", entityType: "private_trip_settings" });
    res.json(status);
  } catch (error) {
    res.status(error instanceof PrivateTripSettingsError ? 400 : 500).json({ error: error instanceof PrivateTripSettingsError ? error.message : "Could not save private-trip settings." });
  }
});
export default router;
