import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { config } from "../config.js";

const context = Buffer.from("tripanza-ai-provider-key-v1");
const encryptionKey = Buffer.from(hkdfSync("sha256", config.appSecret, "tripanza-workspace", context, 32));
async function savedCredential() {
  return (await db.select().from(schema.aiCredentials).where(eq(schema.aiCredentials.id, "provider")).limit(1))[0];
}
export async function aiProviderStatus() {
  const saved = await savedCredential();
  let provider = "Configured provider"; try { provider = new URL(config.ai.baseUrl).hostname; } catch { /* do not expose credentials embedded in URLs */ }
  return { configured: !!saved || !!config.ai.apiKey, source: saved ? "workspace" : config.ai.apiKey ? "environment" : "none", environmentConfigured: !!config.ai.apiKey, model: config.ai.model, provider };
}
export async function saveAiApiKey(apiKey: unknown) {
  if (typeof apiKey !== "string" || apiKey.trim().length < 10 || apiKey.trim().length > 4096 || /\s/.test(apiKey.trim())) {
    throw new Error("Enter a valid API key without spaces or line breaks.");
  }
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv); cipher.setAAD(context);
  const encrypted = Buffer.concat([cipher.update(apiKey.trim(), "utf8"), cipher.final()]);
  const value = ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
  await db.insert(schema.aiCredentials).values({ id: "provider", encrypted_key: value, updated_at: new Date().toISOString() }).onConflictDoUpdate({ target: schema.aiCredentials.id, set: { encrypted_key: value, updated_at: new Date().toISOString() } });
}
export async function removeSavedAiKey() {
  await db.delete(schema.aiCredentials).where(eq(schema.aiCredentials.id, "provider"));
}
async function apiKey() {
  const saved = await savedCredential();
  if (!saved) return config.ai.apiKey;
  try {
    const parts = saved.encrypted_key.split(".");
    if (parts.length !== 4 || parts[0] !== "v1") throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(parts[1], "base64url"));
    decipher.setAAD(context); decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
  } catch { throw new Error("The saved AI key could not be opened. Replace it in AI chatbot settings."); }
}
let client: OpenAI | null = null;
let clientKey = "";
let clientUrl = "";
export async function getAiClient() {
  const key = await apiKey();
  if (!key) { client = null; clientKey = ""; clientUrl = ""; return null; }
  if (!client || key !== clientKey || config.ai.baseUrl !== clientUrl) {
    client = new OpenAI({ apiKey: key, baseURL: config.ai.baseUrl, timeout: 30000, maxRetries: 1 });
    clientKey = key; clientUrl = config.ai.baseUrl;
  }
  return client;
}
export async function testAiConnection() {
  const provider = await getAiClient();
  if (!provider) return { success: false, error: "Save an API key first." };
  try {
    const result = await provider.chat.completions.create({
      model: config.ai.model, messages: [{ role: "user", content: "Check AI connection." }],
      tools: [{ type: "function", function: { name: "connection_check", description: "Confirm the provider supports the chatbot's function tools.", parameters: { type: "object", properties: {}, additionalProperties: false } } }],
      tool_choice: { type: "function", function: { name: "connection_check" } }, max_tokens: 64,
    }, { timeout: 15000, maxRetries: 0 });
    const supported = result.choices[0]?.message?.tool_calls?.some(call => call.type === "function" && call.function.name === "connection_check");
    return supported ? { success: true, message: "Connected. Your model supports the chatbot's function tools." }
      : { success: false, error: "The provider responded, but this model did not support the required function tools. Check AI_MODEL and AI_BASE_URL on Render." };
  } catch (error) {
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    // Never reflect provider error bodies or headers: they may include sensitive data.
    const message = status === 401 ? "The provider rejected this API key. Check the key and provider."
      : status === 403 ? "This key does not have permission to use the configured model."
      : status === 429 ? "The provider's quota or rate limit was reached. Check your account billing and limits."
      : status === 404 ? "The model or API endpoint was not found. Check AI_MODEL and AI_BASE_URL on Render."
      : "Could not reach the AI provider. Check the provider settings and try again.";
    return { success: false, error: message };
  }
}
