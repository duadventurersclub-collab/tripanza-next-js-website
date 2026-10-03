"use client";
import { useSiteSettings } from "./SiteSettingsProvider";

export default function FeatureGate({ feature, children }: { feature: "ai_chat_enabled" | "reels_enabled" | "new_bookings_enabled"; children: React.ReactNode }) {
  const settings = useSiteSettings();
  return settings[feature] && (feature !== "ai_chat_enabled" || settings.new_bookings_enabled) ? children : null;
}
