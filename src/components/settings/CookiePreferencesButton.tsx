"use client";
import { useSiteSettings } from "./SiteSettingsProvider";

export default function CookiePreferencesButton() {
  const settings = useSiteSettings();
  if (!settings.ga4_measurement_id && !settings.meta_pixel_id) return <p>Optional analytics and advertising tracking are not configured on this site.</p>;
  return <button type="button" onClick={() => window.dispatchEvent(new Event("tripanza:cookie-settings"))}>Manage cookie choices</button>;
}
