import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import type { Server } from "node:http";
import { runMigrations } from "./db/migrate.js";
import { bootstrapWorkspace } from "./bootstrap.js";
import { config } from "./config.js";
import { db, schema, closeDatabase } from "./db/index.js";
import { initWebSocket, broadcast } from "./ws/index.js";
import { setGatewayAdapter, refreshGatewayStatus, type GatewayAdapter } from "./services/waGateway.js";
import { handleIncomingMessage, recordOutgoingMessage, initOrchestrator } from "./services/orchestrator.js";
import { verifyAccessToken } from "./services/auth.js";
import { startStockSync, stopStockSync } from "./services/stock.js";
import { startUploadCleanup, stopUploadCleanup } from "./services/uploadCleanup.js";
import { startSessionTimeoutCheck, stopSessionTimeoutCheck } from "./services/sessionTimeout.js";
import { apiRateLimitPassthrough } from "./middleware/rateLimit.js";
import { authenticate } from "./middleware/auth.js";
import { startDashboardPeriodic, stopDashboardPeriodic } from "./services/dashboard.js";
import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversations.js";
import customerRoutes from "./routes/customers.js";
import adminRoutes from "./routes/admin.js";
import notificationRoutes from "./routes/notifications.js";
import gatewayRoutes from "./routes/gateway.js";
import websiteRoutes from "./routes/website.js";
import privateTripRoutes from "./routes/privateTrips.js";
import { startWebsiteSync, stopWebsiteSync } from "./services/website.js";
import automationRoutes, { cloudHooks } from "./routes/automation.js";
import { initAutomation, stopAutomation, handleAccountIncoming, publishEvent } from "./services/automation.js";
import { getCrmReplyState } from "./services/crmReplyControls.js";

export async function createBusinessWorkspace(server: Server, adapter: GatewayAdapter) {
  await runMigrations(); await bootstrapWorkspace(); setGatewayAdapter(adapter);
  const app = express();
  app.disable("x-powered-by"); app.set("trust proxy", 1);
  app.use("/api/automation/meta/webhook", cloudHooks);
  app.use("/api/automation", express.json({ limit: "256kb" }));
  app.use(express.json({ limit: "15mb" })); app.use(cookieParser());
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Cache-Control", "no-store"); next();
  });
  app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) { res.status(403).json({ error: "Cross-origin request denied" }); return; } }
      catch { res.status(403).json({ error: "Invalid origin" }); return; }
    }
    next();
  });
  app.use("/api", apiRateLimitPassthrough);
  app.use("/api/auth", authRoutes); app.use("/api/conversations", conversationRoutes);
  app.use("/api/customers", customerRoutes); app.use("/api/admin", adminRoutes);
  app.use("/api/notifications", notificationRoutes); app.use("/api/gateway", gatewayRoutes);
  app.use("/api/admin/website", websiteRoutes);
  app.use("/api/admin/private-trips", privateTripRoutes);
  app.use("/api/automation", automationRoutes);
  app.get("/api/health", async (_req, res) => {
    try { await db.select().from(schema.users).limit(1); res.json({ status: "ok", gateway: "tripanza-crm" }); }
    catch { res.status(503).json({ error: "Database unavailable" }); }
  });
  app.get("/uploads/:filename", authenticate, (req, res) => {
    res.sendFile(path.resolve(config.uploadDir, path.basename(String(req.params.filename))), err => {
      if (err && !res.headersSent) res.status(404).json({ error: "File not found" });
    });
  });
  app.use((_req, res) => { res.status(404).json({ error: "Not found" }); });
  app.use(((err, _req, res, _next) => {
    console.error("[workspace] Request failed:", err.message);
    if (!res.headersSent) res.status(err.status === 413 ? 413 : 500).json({ error: err.status === 413 ? "File too large" : "Request failed" });
  }) as express.ErrorRequestHandler);
  const io = initWebSocket(server);
  initOrchestrator();
  await refreshGatewayStatus();
  const timer = setInterval(() => { refreshGatewayStatus().then(status => broadcast("gateway:status", status)).catch(console.error); }, 5000); timer.unref();
  startStockSync(); startUploadCleanup(); startSessionTimeoutCheck(); startDashboardPeriodic();
  startWebsiteSync();
  await initAutomation({ recordOutgoing: recordOutgoingMessage });
  return {
    app, handleIncoming: handleIncomingMessage, recordOutgoing: recordOutgoingMessage, getCrmReplyState,
    handleGatewayIncoming: handleAccountIncoming, publishGatewayEvent: publishEvent,
    async close() {
      clearInterval(timer); stopStockSync(); stopUploadCleanup(); stopSessionTimeoutCheck();
      stopDashboardPeriodic();
      await stopWebsiteSync();
      await stopAutomation();
      io.disconnectSockets(true); io.engine.close(); closeDatabase();
    },
  };
}
