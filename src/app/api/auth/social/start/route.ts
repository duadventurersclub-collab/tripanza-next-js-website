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
  const target = new URL(wordpress);
  target.searchParams.set("tripanza_oauth", "start");
  target.searchParams.set("provider", provider);
  target.searchParams.set("return", callback.toString());
  target.searchParams.set("oauth_request", `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "")}`);
  return NextResponse.redirect(target);
}
