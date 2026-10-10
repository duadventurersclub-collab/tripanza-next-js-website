import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, isAccessTokenRevoked } from "../services/auth.js";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  user?: { sub: string; role: string };
}

// Extract the access token, preferring the httpOnly cookie (set at login) and
// falling back to the Authorization header for backward compatibility and
// non-browser clients. Cookie-first means the token never needs to live in
// JS-readable storage, removing the XSS exfiltration path.
export function extractToken(req: Request): string | null {
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.access_token;
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1] || null;
  }
  return null;
}

const ROLE_LEVEL: Record<string, number> = {
  super_admin: 3,
  admin: 2,
  cs: 1,
};

export function getRoleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? 0;
}

export function canModifyRole(
  actorRole: string,
  targetRole: string
): boolean {
  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
}

export function canModifyUser(
  actorRole: string,
  actorId: string,
  targetRole: string,
  targetId: string
): boolean {
  if (actorId === targetId) return false;
  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
}

async function authenticatedUser(req: AuthRequest): Promise<{ user: { sub: string; role: string }; error?: never } | { error: string; user?: never }> {
  const token = extractToken(req);
  if (!token) return { error: "Unauthorized" };
  try {
    const payload = verifyAccessToken(token);
    if (await isAccessTokenRevoked(token)) throw new Error("Session ended");

    // JWTs are stateless, so a valid (unexpired) token would otherwise keep
    // working for up to 15 min after an admin deactivates or deletes the user.
    // Verify the account still exists and is active on every request so
    // deactivation takes effect immediately.
    const rows = await db
      .select({ is_active: schema.users.is_active, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, payload.sub))
      .limit(1);

    if (rows.length === 0 || !rows[0].is_active) {
      return { error: "Account inactive or not found" };
    }

    return { user: { sub: payload.sub, role: rows[0].role } };
  } catch {
    return { error: "Invalid or expired token" };
  }
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const result = await authenticatedUser(req);
  if (!result.user) { res.status(401).json({ error: result.error }); return; }
  req.user = result.user; next();
}

/** Pairing pages use the same live account and revoked-session checks as the API. */
export async function authenticateGatewayPage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.vary("Cookie").vary("Authorization");
  const result = await authenticatedUser(req);
  if (!result.user) { res.redirect(303, "/login?return_to=%2Fadmin%2Fgateway"); return; }
  req.user = result.user; next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { sub: payload.sub, role: payload.role };
  } catch {
    // optional auth — token invalid, continue without user
  }
  next();
}
