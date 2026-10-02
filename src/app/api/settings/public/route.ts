import { getSiteSettings } from "@/lib/site-settings";

export async function GET() {
  return Response.json(await getSiteSettings(), { headers: { "Cache-Control": "no-store" } });
}
