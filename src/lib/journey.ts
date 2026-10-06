import { randomUUID } from "node:crypto";

export const JOURNEY_COOKIE = "tripanza_journey";

export function journeyIdFromRequest(request: Request): string {
  const value = request.headers.get("cookie")?.match(/(?:^|;\s*)tripanza_journey=([a-f0-9-]{36})(?:;|$)/i)?.[1] || "";
  return /^[a-f0-9-]{36}$/i.test(value) ? value : "";
}

export function newJourneyId(): string {
  return randomUUID();
}

export async function recordJourney(payload: Record<string, unknown>): Promise<boolean> {
  const secret = process.env.TRIPANZA_JOURNEY_SECRET;
  if (!secret) return false;
  const origin = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`${origin}/wp-json/tripanza-journey/v1/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tripanza-Journey-Secret": secret },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
