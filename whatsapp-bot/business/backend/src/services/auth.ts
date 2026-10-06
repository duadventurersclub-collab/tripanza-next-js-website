import bcrypt from "bcrypt";
import { createHash, randomUUID } from "node:crypto";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { config } from "../config.js";
import { db, schema } from "../db/index.js";
import { generateId } from "../utils/id.js";
import { eq, and } from "drizzle-orm";

const SALT_ROUNDS = 12;

// Precomputed at module load: a valid bcrypt hash used as a comparison target
// when a login email is not found or the account is inactive. Comparing against
// it keeps the login code path's timing constant regardless of whether the
// email exists, defeating timing-based email enumeration. It must be a REAL
// bcrypt hash (not a malformed string) or bcrypt.compare would short-circuit.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("invalid-password-placeholder", SALT_ROUNDS);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface TokenPayload {
  sub: string;
  role: string;
}

const accessOptions: SignOptions = { expiresIn: config.jwt.accessExpiresIn as SignOptions["expiresIn"] };
const refreshOptions: SignOptions = { expiresIn: config.jwt.refreshExpiresIn as SignOptions["expiresIn"] };

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, type: "access", jti: randomUUID() }, config.appSecret, accessOptions);
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, type: "refresh", jti: randomUUID() }, config.refreshSecret, refreshOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.appSecret) as JwtPayload & { type?: string };
  if (!decoded.type || decoded.type !== "access") {
    throw new Error("Invalid token type");
  }
  if (!decoded.sub || !decoded.role) {
    throw new Error("Invalid token payload");
  }
  return { sub: decoded.sub as string, role: decoded.role as string };
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.refreshSecret) as JwtPayload & { type?: string };
  if (!decoded.type || decoded.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  if (!decoded.sub || !decoded.role) {
    throw new Error("Invalid token payload");
  }
  return { sub: decoded.sub as string, role: decoded.role as string };
}

export async function storeRefreshToken(
  userId: string,
  token: string
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  await db.insert(schema.refreshTokens).values({
    id: generateId(),
    user_id: userId,
    token,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    revoked: false,
  });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db
    .update(schema.refreshTokens)
    .set({ revoked: true })
    .where(eq(schema.refreshTokens.token, token));
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db
    .update(schema.refreshTokens)
    .set({ revoked: true })
    .where(
      and(
        eq(schema.refreshTokens.user_id, userId),
        eq(schema.refreshTokens.revoked, false)
      )
    );
}

export async function isRefreshTokenValid(token: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(schema.refreshTokens)
    .where(
      and(
        eq(schema.refreshTokens.token, token),
        eq(schema.refreshTokens.revoked, false)
      )
    )
    .limit(1);

  if (rows.length === 0) return false;
  const rt = rows[0];
  if (new Date(rt.expires_at) < new Date()) return false;
  return true;
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function revokeAccessToken(token: string) {
  const decoded = jwt.decode(token) as JwtPayload | null;
  if (!decoded?.exp) return;
  await db.insert(schema.revokedAccessTokens).values({ token_hash: tokenHash(token), expires_at: new Date(decoded.exp * 1000).toISOString() }).onConflictDoNothing();
}
export async function isAccessTokenRevoked(token: string) {
  return (await db.select().from(schema.revokedAccessTokens).where(eq(schema.revokedAccessTokens.token_hash, tokenHash(token))).limit(1)).length > 0;
}
