import { fetchSiteSettings } from "./site-settings";
import { DEFAULT_SETTINGS, type SiteSettings } from "./site-settings-types";

// Proxy has no Next Data Cache. Bound this small public-control snapshot to ten
// seconds, coalesce concurrent requests, and never cache an administrator bypass.
let snapshot: { settings: SiteSettings; expires: number } | undefined;
let pending: Promise<SiteSettings> | undefined;
let generation = 0;

export function resetTourPageControls() {
  generation++;
  snapshot = undefined;
  pending = undefined;
}

export function getTourPageControls(waitUntil?: (promise: Promise<unknown>) => void): Promise<SiteSettings> {
  if (snapshot && snapshot.expires > Date.now()) return Promise.resolve(snapshot.settings);
  if (pending) return snapshot ? Promise.resolve(snapshot.settings) : pending;
  const version = generation;
  const request = fetchSiteSettings().then(settings => {
    if (version === generation) snapshot = { settings, expires: Date.now() + 10_000 };
    return settings;
  }).catch(() => {
    // Preserve a known maintenance state during an outage; retry shortly.
    const settings = snapshot?.settings || DEFAULT_SETTINGS;
    if (version === generation) snapshot = { settings, expires: Date.now() + 2_000 };
    return settings;
  }).finally(() => { if (pending === request) pending = undefined; });
  pending = request;
  if (snapshot) {
    // Keep serving the last verified public controls while WordPress refreshes.
    // Proxy fetches cannot use Next's Data Cache; waitUntil keeps this refresh
    // alive after the response has been sent.
    waitUntil?.(request);
    return Promise.resolve(snapshot.settings);
  }
  return request;
}
