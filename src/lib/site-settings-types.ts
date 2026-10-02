export type SiteSettings = {
  host_enabled: boolean;
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
export type AdminSettings = { settings: SiteSettings; capabilities: { pdf: boolean; page_cache: boolean } };
export type CacheScope = "all" | "tours" | "reels" | "hosts" | "site" | "bookings" | "browser" | "pdf" | "pdf_all" | "page_cache";
export const DEFAULT_SETTINGS: SiteSettings = {
  host_enabled: false, public_cache_enabled: true, tour_cache_seconds: 300, availability_cache_seconds: 60,
  reel_cache_seconds: 300, host_cache_seconds: 60, site_cache_seconds: 3600,
  leaderboard_cache_seconds: 600, booking_cache_seconds: 15, browser_cache_seconds: 3300,
  cache_revision: "initial", revision: "initial", updated_at: "",
};
