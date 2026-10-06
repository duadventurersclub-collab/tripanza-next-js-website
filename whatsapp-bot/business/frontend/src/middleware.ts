import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function validateJwt(token: string): Promise<{ role: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (header.alg !== "HS256" || payload.type !== "access" || !payload.sub || typeof payload.exp !== "number" || payload.exp <= Date.now() / 1000 || !["cs", "admin", "super_admin"].includes(payload.role) || !process.env.APP_SECRET) return null;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(process.env.APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const signature = Uint8Array.from(Buffer.from(parts[2], "base64url"));
    const valid = await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    return valid ? payload : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) return NextResponse.next();

  const token = request.cookies.get("access_token")?.value;
  let payload = token ? await validateJwt(token) : null;
  if (payload) {
    try {
      const origin = `http://127.0.0.1:${process.env.PORT || 3000}`;
      const response = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: `access_token=${token}` }, cache: "no-store", signal: AbortSignal.timeout(3000) });
      if (!response.ok) payload = null;
      else { const { user } = await response.json(); payload = { role: user.role }; }
    } catch { payload = null; }
  }
  const isLogin = pathname === "/login" || pathname === "/login/";

  if (isLogin) {
    // Logged-in user visiting /login — redirect away
    if (payload) {
      const returnTo = request.nextUrl.searchParams.get("return_to");
      if (returnTo && /^\/(?:admin|cs)(?:\/|\?|$)/.test(returnTo) && (payload.role !== "cs" || !returnTo.startsWith("/admin"))) {
        return NextResponse.redirect(new URL(returnTo, request.url));
      }
      if (payload?.role === "cs") {
        return NextResponse.redirect(new URL("/cs?tab=mine", request.url));
      }
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/cs") && !pathname.startsWith("/admin")) return NextResponse.next();

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    const returnPath = pathname + (request.nextUrl.search || "");
    if (returnPath !== "/" && returnPath !== "/login") {
      loginUrl.searchParams.set("return_to", returnPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (payload?.role === "cs" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/cs?tab=mine", request.url));
  }

  // Redirect invalid admin paths to dashboard
  if (pathname.startsWith("/admin/")) {
    const validAdminTabs = ["dashboard", "bot", "stock", "users", "gateway", "audit", "cs_config", "website", "private-trips", "automation"];
    const adminSegment = pathname.replace("/admin/", "").split("/")[0];
    if (adminSegment && !validAdminTabs.includes(adminSegment)) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  if (pathname.startsWith("/cs")) {
    const segments = pathname.split("/").filter(Boolean);
    const chatId = segments[1];
    if (chatId && !UUID_REGEX.test(chatId)) {
      const tab = searchParams.get("tab") || "mine";
      return NextResponse.redirect(new URL(`/cs?tab=${tab}`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|manifest.json|sw.js).*)"],
};
