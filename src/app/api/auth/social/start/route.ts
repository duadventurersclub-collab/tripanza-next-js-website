import { NextRequest, NextResponse } from "next/server";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider");
  if (provider !== "google" && provider !== "linkedin") {
    return NextResponse.redirect(new URL("/?profile=1&auth=1&social_error=Unsupported+login+provider.", request.url));
  }

  const callback = new URL("/api/auth/social/callback", request.url);
  callback.searchParams.set("returnTo", safeReturnTo(request.nextUrl.searchParams.get("returnTo")));
  const wordpress = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");
  const endpoint = new URL(`${wordpress}/wp-json/tripanza-headless/v1/auth/oauth/start`);
  endpoint.searchParams.set("provider", provider);
  endpoint.searchParams.set("return_url", callback.toString());
  try {
    const response = await fetch(endpoint, { cache: "no-store", headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({})) as { auth_url?: string; message?: string };
    if (!response.ok || !data.auth_url) throw new Error(data.message || "This social login provider is not available.");
    return NextResponse.redirect(data.auth_url);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "This social login provider is not available.";
    const target = new URL("/", request.url);
    target.searchParams.set("profile", "1");
    target.searchParams.set("auth", "1");
    target.searchParams.set("social_error", message);
    return NextResponse.redirect(target);
  }
}
