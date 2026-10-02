import type { SiteSettings } from "./site-settings-types";
type BrowserCacheSettings = Pick<SiteSettings, "cache_revision" | "browser_cache_seconds">;
export const ACCOUNT_CACHE_KEY = "tripanza_account_cache_v1";

export function readAccountCache<T>(settings: BrowserCacheSettings): T | null {
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(ACCOUNT_CACHE_KEY) || "null");
    if (!settings.browser_cache_seconds || !cached?.savedAt || cached.revision !== settings.cache_revision || Date.now() - cached.savedAt > settings.browser_cache_seconds * 1000 || !cached.account?.authenticated) {
      window.sessionStorage.removeItem(ACCOUNT_CACHE_KEY);
      return null;
    }
    return cached.account;
  } catch { return null; }
}

export function writeAccountCache<T extends { authenticated?: boolean }>(account: T | null, settings: BrowserCacheSettings) {
  try {
    if (!settings.browser_cache_seconds || !account?.authenticated) window.sessionStorage.removeItem(ACCOUNT_CACHE_KEY);
    else window.sessionStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), revision: settings.cache_revision, account }));
  } catch { /* Storage may be unavailable; the fresh network response still renders. */ }
}
