export type SiteSettings = {
  host_enabled: boolean;
  ai_chat_enabled: boolean;
  reels_enabled: boolean;
  pdf_downloads_enabled: boolean;
  new_bookings_enabled: boolean;
  maintenance_enabled: boolean;
  maintenance_message: string;
  announcement_enabled: boolean;
  announcement_text: string;
  announcement_link: string;
  featured_tour_slugs: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  whatsapp_number: string;
  instagram_url: string;
  facebook_url: string;
  error_alerts_enabled: boolean;
  alert_email: string;
  public_cache_enabled: boolean;
  tour_cache_seconds: number;
  availability_cache_seconds: number;
  reel_cache_seconds: number;
  host_cache_seconds: number;
  site_cache_seconds: number;
  leaderboard_cache_seconds: number;
  booking_cache_seconds: number;
  browser_cache_seconds: number;
  cache_revision: string;
  revision: string;
  updated_at: string;
  updated_by?: string;
};
export type AdminSettings = { settings: SiteSettings; controls_version?: string; capabilities: { pdf: boolean; page_cache: boolean } };
export type Operations = {
  checked_at: string;
  health: { wordpress_version: string; php_version: string; database: boolean; monitoring_configured: boolean; plugins: { name: string; version: string; active: boolean }[] };
  audit: { action: string; user_id: number; actor?: string; at: string; changes?: Record<string, { from: unknown; to: unknown }> }[];
  errors: { code: string; area: string; count: number; first_at: string; last_at: string; mail_status?: string }[];
  diagnostics?: { response_ms: number; upstream_cache: string; upstream_age: string; stale_settings: boolean | null; next_version: string; monitoring_configured: boolean; public_revision: string | null; saved_revision: string };
};
export type CacheScope = "all" | "tours" | "reels" | "hosts" | "site" | "bookings" | "browser" | "pdf" | "pdf_all" | "page_cache";
export const DEFAULT_SETTINGS: SiteSettings = {
  host_enabled: false, public_cache_enabled: true, tour_cache_seconds: 300, availability_cache_seconds: 60,
  ai_chat_enabled: true, reels_enabled: true, pdf_downloads_enabled: true, new_bookings_enabled: true,
  maintenance_enabled: false, maintenance_message: "We are making Tripanza even better. Please check back shortly.",
  announcement_enabled: false, announcement_text: "", announcement_link: "", featured_tour_slugs: "",
  contact_email: "hello@tripanza.com", contact_phone: "+918130117254", contact_address: "Dwarka, Delhi NCR, India",
  whatsapp_number: "918130117254", instagram_url: "", facebook_url: "", error_alerts_enabled: false, alert_email: "",
  reel_cache_seconds: 300, host_cache_seconds: 60, site_cache_seconds: 3600,
  leaderboard_cache_seconds: 600, booking_cache_seconds: 15, browser_cache_seconds: 3300,
  cache_revision: "initial", revision: "initial", updated_at: "",
};
