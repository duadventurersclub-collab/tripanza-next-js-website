import { getAdminIdentity, ADMIN_NO_STORE } from "@/lib/admin-dashboard";

export async function GET() {
  const admin = await getAdminIdentity();
  if (admin.status !== 200) {
    return Response.json({ error: "Administrator access required." }, { status: 403, headers: ADMIN_NO_STORE });
  }

  return Response.json({ error: "Pairing is unavailable until the integrated WhatsApp engine is activated." }, { status: 503, headers: ADMIN_NO_STORE });
}
