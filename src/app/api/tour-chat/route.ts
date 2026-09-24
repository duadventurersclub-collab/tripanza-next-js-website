import { NextResponse } from "next/server";

const WORDPRESS_URL = (
  process.env.WORDPRESS_URL ||
  process.env.NEXT_PUBLIC_WORDPRESS_URL ||
  "https://tripanza.com"
).replace(/\/$/, "");

const ACTION_ENDPOINTS = {
  ask: "ask",
  sync: "sync-history",
  clear: "clear-history",
} as const;

type ChatAction = keyof typeof ACTION_ENDPOINTS;

function isChatToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/i.test(value);
}

function cleanTourSlug(value: unknown) {
  if (typeof value !== "string") return "";
  const slug = value.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

function cleanHistory(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-12)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const message = item as Record<string, unknown>;
      const role = message.role === "user" ? "user" : message.role === "assistant" ? "assistant" : null;
      const content = typeof message.content === "string" ? message.content.trim().slice(0, 2000) : "";
      return role && content ? { role, content } : null;
    })
    .filter(Boolean);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action: ChatAction = body.action === "sync" || body.action === "clear" ? body.action : "ask";
    const chatToken = body.chatToken;
    const tourId = Number(body.tourId);

    if (!isChatToken(chatToken)) {
      return NextResponse.json({ error: "A valid chat session is required." }, { status: 400 });
    }

    if (!Number.isInteger(tourId) || tourId <= 0) {
      return NextResponse.json({ error: "A valid tour is required." }, { status: 400 });
    }

    const upstreamBody: Record<string, unknown> = {
      chat_token: chatToken,
      post_id: tourId,
    };

    if (action === "ask") {
      const question = typeof body.question === "string" ? body.question.trim() : "";
      const tourSlug = cleanTourSlug(body.tourSlug);
      if (!question || question.length > 1000) {
        return NextResponse.json(
          { error: question ? "Please keep your message under 1,000 characters." : "Please type a question first." },
          { status: 400 },
        );
      }

      if (!tourSlug) {
        return NextResponse.json({ error: "This tour could not be identified." }, { status: 400 });
      }

      upstreamBody.question = question;
      // The Next.js model deliberately uses /tours/{slug} for internal links,
      // while the WordPress AI resolves context from its /tour/{slug} permalink.
      upstreamBody.url = `${WORDPRESS_URL}/tour/${encodeURIComponent(tourSlug)}/`;
      upstreamBody.history = cleanHistory(body.history);
      upstreamBody.client_bootstrap = Boolean(body.clientBootstrap);
      if (typeof body.bookingState === "string" && body.bookingState.length <= 10000) {
        upstreamBody.booking_state = body.bookingState;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    let response: Response;
    try {
      response = await fetch(
        `${WORDPRESS_URL}/wp-json/tripanza-ai/v1/${ACTION_ENDPOINTS[action]}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(upstreamBody),
          cache: "no-store",
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const message =
        (typeof payload.reply === "string" && payload.reply) ||
        (typeof payload.message === "string" && payload.message) ||
        (typeof payload.error === "string" && payload.error) ||
        "Kanika is temporarily unavailable. Please try again.";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    console.error("Tour chat proxy failed:", error);
    return NextResponse.json(
      { error: timedOut ? "Kanika is taking longer than usual. Please try again." : "Could not reach Kanika right now." },
      { status: timedOut ? 504 : 502 },
    );
  }
}
