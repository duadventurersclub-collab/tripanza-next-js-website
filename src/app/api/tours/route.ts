import { NextRequest } from "next/server";
import { getAppTours } from "@/lib/st-tours";
import { homeTourSummary } from "@/lib/homepage-data";

export async function GET(request: NextRequest) {
  const rawPage = Number(request.nextUrl.searchParams.get("page") || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 50 ? rawPage : 1;
  try {
    const { items, total } = await getAppTours({ page, per_page: 100, admin_only: true });
    return Response.json({ items: items.map(homeTourSummary), total, page }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Trips are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
