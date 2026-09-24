import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RevalidationPayload = {
  slug?: unknown;
  source?: unknown;
};

function secretsMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const expectedSecret = process.env.REVALIDATION_SECRET || "";
  if (!expectedSecret) {
    return NextResponse.json({ error: "Revalidation is not configured" }, { status: 503 });
  }

  const receivedSecret = request.headers.get("x-tripanza-revalidate-secret") || "";
  if (!secretsMatch(receivedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Invalid revalidation secret" }, { status: 401 });
  }

  let payload: RevalidationPayload;
  try {
    payload = (await request.json()) as RevalidationPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const slug = typeof payload.slug === "string"
    ? payload.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
    : "";
  const source = typeof payload.source === "string" ? payload.source.trim().toLowerCase() : "";

  revalidateTag("tours", { expire: 0 });
  revalidateTag("meta-reels", { expire: 0 });
  if (slug) revalidateTag(`tour:${slug}`, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/tours");
  revalidatePath("/trips");
  if (slug) revalidatePath(`/tours/${slug}`);
  else revalidatePath("/tours/[slug]", "page");

  return NextResponse.json({
    revalidated: true,
    slug: slug || null,
    source: source || null,
    now: new Date().toISOString(),
  });
}
