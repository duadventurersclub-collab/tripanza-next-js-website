import { getSiteSettings } from "./site-settings";
import { adminRequest } from "./admin-settings";

export async function featureUnavailable(feature: "ai_chat_enabled" | "reels_enabled" | "pdf_downloads_enabled" | "new_bookings_enabled") {
  const settings = await getSiteSettings();
  const maintenance = settings.maintenance_enabled && !(await adminRequest("settings")).ok;
  if (settings[feature] && !maintenance) return null;
  const message = maintenance ? settings.maintenance_message : "This feature is temporarily unavailable. Please try again later or contact Tripanza.";
  return Response.json({ error: message, message }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" } });
}
