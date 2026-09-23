import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function authModalUrl(request: NextRequest, returnTo: string, error?: string) {
  const target = new URL(returnTo, request.url);
  target.searchParams.set("profile", "1");
  if (error) {
    target.searchParams.set("auth", "1");
    target.searchParams.set("social_error", error);
  }
  return target;
}

export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const providerError = request.nextUrl.searchParams.get("social_login_error");
  const ticket = request.nextUrl.searchParams.get("ticket");
  if (providerError || !ticket) {
    return NextResponse.redirect(authModalUrl(request, returnTo, providerError || "Social login could not be completed."));
  }

  try {
    const wordpress = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");
    const response = await fetch(`${wordpress}/wp-json/tripanza-app/v1/oauth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ticket }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({})) as { session_token?: string; message?: string };
    if (!response.ok || !data.session_token) throw new Error(data.message || "The social login handoff expired. Please try again.");
    await setSessionCookie(data.session_token);
    return NextResponse.redirect(authModalUrl(request, returnTo));
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Social login could not be completed.";
    return NextResponse.redirect(authModalUrl(request, returnTo, message));
  }
}
