import { getAdminIdentity } from "@/lib/admin-dashboard";
import { wordpressOrigin } from "@/lib/site-settings";

export async function GET() {
  const admin = await getAdminIdentity();
  if (admin.status !== 200) return Response.json({ message: admin.status === 401 || admin.status === 403 ? "Administrator access required." : "Administrator session could not be verified." }, { status: admin.status });
  try {
    const response = await fetch(`${wordpressOrigin}/wp-json/tripanza-headless/v1/homepage/catalog`, {
      cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json();
    return Response.json(data, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ message: "Tour categories are unavailable. Check the Site Controls plugin in WordPress." }, { status: 503 });
  }
}
