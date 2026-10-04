import { getAdminIdentity, ADMIN_NO_STORE } from "@/lib/admin-dashboard";

export async function GET() {
  const admin = await getAdminIdentity();
  if (admin.status !== 200) {
    return Response.json({ error: "Administrator access required." }, { status: 403, headers: ADMIN_NO_STORE });
  }

  // The opt-in custom server intercepts this path before Next.js when the
  // integrated engine is active. Reaching this handler means it is not running.
  return Response.json({
    enabled: false,
    message: "The integrated WhatsApp bot is not activated on this Next.js service. The original bot is unaffected.",
  }, { status: 503, headers: ADMIN_NO_STORE });
}
