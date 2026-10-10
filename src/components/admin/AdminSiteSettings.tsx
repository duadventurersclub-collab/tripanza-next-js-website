"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminSettings, CacheScope, SiteSettings } from "@/lib/site-settings-types";
import { DEFAULT_SETTINGS } from "@/lib/site-settings-types";
import AdminAdvancedControls from "./AdminAdvancedControls";
import AdminOperations from "./AdminOperations";
import AdminPageCache from "./AdminPageCache";
import AdminHomepageTours from "./AdminHomepageTours";

const fields: { key: keyof SiteSettings; label: string; note: string; max: number }[] = [
  { key: "tour_cache_seconds", label: "Tour listings & details", note: "Public trip data and gallery lookups.", max: 86400 },
  { key: "availability_cache_seconds", label: "Departure availability", note: "Availability feed snapshots. Booking prices and dates are rechecked live before ordering.", max: 300 },
  { key: "reel_cache_seconds", label: "Discovery reels", note: "The public trip discovery feed.", max: 86400 },
  { key: "host_cache_seconds", label: "Public Host data", note: "Host landing data. Profiles configured as live remain live.", max: 3600 },
  { key: "site_cache_seconds", label: "Site information", note: "Name, description and public site metadata.", max: 86400 },
  { key: "leaderboard_cache_seconds", label: "Host leaderboard", note: "WordPress monthly earnings leaderboard.", max: 3600 },
  { key: "booking_cache_seconds", label: "Server booking cache", note: "Per-session booking history only. Maximum 60 seconds.", max: 60 },
  { key: "browser_cache_seconds", label: "Browser account preview", note: "Per-tab cached account preview while fresh data loads. Maximum 55 minutes.", max: 3300 },
];
const purges: { scope: CacheScope; label: string; note: string }[] = [
  { scope: "all", label: "Refresh all app caches", note: "All Next.js public data, page output, booking caches and browser previews. Does not delete PDFs or flush WordPress sessions." },
  { scope: "tours", label: "Tours", note: "Trip listings, trip detail pages and galleries." },
  { scope: "reels", label: "Discovery reels", note: "Public discovery feed." },
  { scope: "hosts", label: "Host data", note: "Host pages and WordPress monthly leaderboard." },
  { scope: "site", label: "Site metadata", note: "Site information and page output." },
  { scope: "bookings", label: "Booking history", note: "Expires per-session server snapshots on their next request." },
  { scope: "browser", label: "Browser previews", note: "Rotates the cache generation. Open tabs pick it up within 30 seconds or on focus/navigation." },
];

const adminPages: { key: "admin_dashboard_enabled" | "admin_booking_history_enabled" | "admin_booking_create_enabled" | "admin_booking_editor_enabled"; label: string; note: string }[] = [
  { key: "admin_dashboard_enabled", label: "Admin dashboard", note: "Hide /admin and block its workspace API." },
  { key: "admin_booking_history_enabled", label: "Booking history", note: "Hide /admin/bookings and block history reads and actions." },
  { key: "admin_booking_create_enabled", label: "Create bookings", note: "Hide /admin/bookings/create and block booking creation." },
  { key: "admin_booking_editor_enabled", label: "Booking editor", note: "Hide editor actions and block the editor API and direct page." },
];

async function api(path: string, body?: unknown) {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "The request could not complete. No changes confirmed.");
  return data;
}

export default function AdminSiteSettings({ initial }: { initial: AdminSettings }) {
  const router = useRouter();
  const [current, setCurrent] = useState({ ...initial, settings: { ...DEFAULT_SETTINGS, ...initial.settings } });
  const [draft, setDraft] = useState({ ...DEFAULT_SETTINGS, ...initial.settings });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [tourId, setTourId] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(current.settings);
  const [controlsMajor, controlsMinor] = (current.controls_version || "0.0").split(".").map(Number);
  const supportsAdminPages = controlsMajor > 1 || (controlsMajor === 1 && controlsMinor >= 2);
  const supportsDiscovery = controlsMajor > 1 || (controlsMajor === 1 && controlsMinor >= 3);
  const supportsHomepageTours = controlsMajor > 1 || (controlsMajor === 1 && controlsMinor >= 4);
  const supportsCrawlerControls = controlsMajor > 1 || (controlsMajor === 1 && controlsMinor >= 5);
  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setDraft(s => ({ ...s, [key]: value }));
  const changed = () => { window.dispatchEvent(new Event("tripanza:settings-changed")); router.refresh(); };

  async function reload() {
    const next: AdminSettings = await api("/api/admin/settings");
    next.settings = { ...DEFAULT_SETTINGS, ...next.settings };
    setCurrent(next); setDraft(next.settings); return next;
  }
  async function save() {
    if (!draft.host_enabled && current.settings.host_enabled && !window.confirm("Turn off the Host feature completely? Registration, public profiles, dashboards, APIs and studios will be blocked. Existing data is preserved.")) return;
    if (draft.maintenance_enabled && !current.settings.maintenance_enabled && !window.confirm("Enable maintenance mode? Non-admin visitors will see a temporary unavailable page. Account, payment, contact and admin recovery access remain available.")) return;
    setBusy("save"); setNotice(null);
    try {
      const next: AdminSettings = await api("/api/admin/settings", draft);
      next.settings = { ...DEFAULT_SETTINGS, ...next.settings };
      setCurrent(next); setDraft(next.settings); changed();
      setNotice({ text: "Settings saved. Feature and cache policies are enforced server-side; open app tabs update within 30 seconds or on navigation/focus." });
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "Could not save.", error: true }); }
    finally { setBusy(""); }
  }
  async function purge(scope: CacheScope) {
    if (!window.confirm(scope === "pdf_all" ? "Clear cached PDF files for all tours using the installed Tripanza PDF module? Cached output will regenerate when requested." : `Refresh ${scope === "all" ? "all app" : scope.replaceAll("_", " ")} caches? Stored accounts, trips and bookings are not deleted.`)) return;
    setBusy(scope); setNotice(null);
    let processed = 0;
    try {
      let cursor = 0, files = 0;
      for (let batch = 0; batch < 10000; batch++) {
        const result = await api("/api/admin/cache", { scope, tour_id: Number(tourId), cursor });
        processed += result.tours || 0; files += result.files || 0;
        if (scope !== "pdf_all" || result.done) break;
        if (!Number.isInteger(result.cursor) || result.cursor <= cursor) throw new Error("PDF cache operation stopped because the server cursor did not advance.");
        cursor = result.cursor;
        setNotice({ text: `Clearing PDF cache… ${processed} tours processed.` });
        if (batch === 9999) throw new Error("Batch limit reached. Run the operation again to continue.");
      }
      await reload(); changed();
      setNotice({ text: scope.startsWith("pdf") ? `PDF cache cleared: ${files} generated files across ${processed} tours.` : "Cache refresh requested. Fresh data is fetched on the next visit. Open tabs pick up preview changes within 30 seconds." });
    } catch (error) { setNotice({ text: `${error instanceof Error ? error.message : "Cache refresh failed."}${processed ? ` ${processed} tours were processed before stopping.` : ""}`, error: true }); }
    finally { setBusy(""); }
  }

  return <main className="admin-settings">
    <header className="as-header"><div><p className="as-eyebrow">TRIPANZA / ADMIN CONTROLS</p><h1>Your site.<br /><em>Your controls.</em></h1><p>Manage speed, freshness and Host access in one place.</p></div><span className={`as-status ${current.settings.host_enabled ? "on" : ""}`}>{current.settings.host_enabled ? "Host enabled" : "Host disabled"}</span></header>
    <section className="as-card as-host"><div><p className="as-eyebrow">FEATURE CONTROL</p><h2>Host system</h2><p>One switch for registration, public Host profiles, reels, dashboards, CRM, payouts and poster/trip studios. Turning it off preserves all existing data and keeps traveller bookings available.</p><small>Server-side enforcement · No administrator bypass for Host tools · Admin settings stay accessible</small></div><label className="as-toggle"><input type="checkbox" checked={draft.host_enabled} disabled={!!busy} onChange={e => update("host_enabled", e.target.checked)} /><span /><b>{draft.host_enabled ? "Enabled" : "Disabled"}</b></label></section>
    <section className="as-card"><p className="as-eyebrow">ADMIN PAGE ACCESS</p><h2>Native admin pages</h2><p>Turn off individual Next.js admin pages without changing WordPress tools or Host-shared pages. Disabled pages redirect to Site Settings; their WordPress APIs are blocked. This settings page always stays available.</p>
      {!supportsAdminPages && <p className="as-notice error">Update the Tripanza Site Controls WordPress plugin to v1.2.0 before changing these switches.</p>}
      <div className="as-admin-pages">{adminPages.map(page => <div className="as-field" key={page.key}><span><strong>{page.label}</strong><small>{page.note}</small></span><label className="as-toggle"><input type="checkbox" checked={draft[page.key]} disabled={!!busy || !supportsAdminPages} onChange={e => update(page.key, e.target.checked)} aria-label={page.label} /><span /><b>{draft[page.key] ? "Enabled" : "Disabled"}</b></label></div>)}</div>
      <div className="as-save"><button className="as-primary" onClick={save} disabled={!!busy || !dirty}>{busy === "save" ? "Saving…" : "Save page access →"}</button><small>Switches take effect only after saving.</small></div>
    </section>
    <AdminAdvancedControls draft={draft} update={update} disabled={!!busy} supported={controlsMajor > 1 || (controlsMajor === 1 && controlsMinor >= 1)} />
    <AdminHomepageTours draft={draft} update={update} disabled={!!busy} supported={supportsHomepageTours} save={() => { void save(); }} busy={busy === "save"} dirty={dirty} />
    <section className="as-card"><p className="as-eyebrow">SEARCH & MEASUREMENT</p><h2>Be discoverable. Measure responsibly.</h2><p>The sitemap and canonical URLs use the Vercel production domain until you set a custom Next.js domain below. Search Console verification proves ownership but does not submit or index pages automatically. GA4 and Meta Pixel load only after a visitor opts in to their respective cookie category.</p>
      {!supportsDiscovery && <p className="as-notice error">Update Tripanza Site Controls in WordPress to v1.3.0 to save these fields.</p>}
      <div className="as-content-fields">
        <label className="as-text-field">Canonical Next.js site origin<input aria-label="Canonical Next.js site origin" type="url" maxLength={255} placeholder="https://your-public-domain.com" value={draft.seo_site_url} disabled={!!busy || !supportsDiscovery} onChange={e => update("seo_site_url", e.target.value)} /><small>Optional while using the Vercel domain. Set this to the new HTTPS domain when it serves the Next.js site; do not enter the WordPress domain while WordPress still serves it.</small></label>
        <label className="as-text-field">Google Analytics 4 Measurement ID<input aria-label="Google Analytics 4 Measurement ID" maxLength={24} placeholder="G-XXXXXXXXXX" value={draft.ga4_measurement_id} disabled={!!busy || !supportsDiscovery} onChange={e => update("ga4_measurement_id", e.target.value.trim().toUpperCase())} /><small>Optional. Analytics stays off until a visitor accepts analytics cookies. In GA4 Enhanced Measurement, disable automatic browser-history page views to avoid duplicate SPA views.</small></label>
        <label className="as-text-field">Meta Pixel ID<input aria-label="Meta Pixel ID" inputMode="numeric" maxLength={30} placeholder="Numeric Pixel ID" value={draft.meta_pixel_id} disabled={!!busy || !supportsDiscovery} onChange={e => update("meta_pixel_id", e.target.value.trim())} /><small>Optional. Meta Pixel stays off until a visitor accepts marketing cookies.</small></label>
        <label className="as-text-field">Google Search Console verification token<input aria-label="Google Search Console verification token" maxLength={180} placeholder="Content value from google-site-verification meta tag" value={draft.google_site_verification} disabled={!!busy || !supportsDiscovery} onChange={e => update("google_site_verification", e.target.value.trim())} /><small>Use the HTML-tag method and paste only the content value. After saving, click Verify in Search Console for this exact public domain.</small></label>
      </div>
      <h3>AI crawler access</h3>
      <p>These choices update this Next.js domain&apos;s robots.txt. For AI discovery without opting in to model training, allow search discovery and disallow training. These are requests to compliant crawlers, not a security barrier or a guarantee of appearing in AI answers. They do not change the WordPress domain.</p>
      {!supportsCrawlerControls && <p className="as-notice error">Update Tripanza Site Controls in WordPress to v1.5.0 to save AI crawler choices.</p>}
      <div className="as-admin-pages">
        <div className="as-field"><span><strong>AI search discovery</strong><small>Allow the documented automatic search crawlers for ChatGPT, Claude and Perplexity. Google Search, including its AI features, uses Googlebot and is not controlled by this switch.</small></span><label className="as-toggle"><input type="checkbox" aria-label="AI search discovery" checked={draft.ai_search_crawlers_enabled} disabled={!!busy || !supportsCrawlerControls} onChange={e => update("ai_search_crawlers_enabled", e.target.checked)} /><span /><b>{draft.ai_search_crawlers_enabled ? "Allowed" : "Disallowed"}</b></label></div>
        <div className="as-field"><span><strong>AI model training</strong><small>Allow GPTBot and ClaudeBot, plus Google-Extended for Gemini training and grounding. Turning this off does not remove pages from ordinary Google Search.</small></span><label className="as-toggle"><input type="checkbox" aria-label="AI model training" checked={draft.ai_training_crawlers_enabled} disabled={!!busy || !supportsCrawlerControls} onChange={e => update("ai_training_crawlers_enabled", e.target.checked)} /><span /><b>{draft.ai_training_crawlers_enabled ? "Allowed" : "Disallowed"}</b></label></div>
      </div>
      <div className="as-save"><button className="as-primary" onClick={save} disabled={!!busy || !dirty}>{busy === "save" ? "Saving…" : "Save search settings →"}</button><small>Save first, then verify the live site and submit its sitemap.</small></div>
    </section>
    <section className="as-card"><div className="as-section-head"><div><p className="as-eyebrow">CACHE POLICY</p><h2>Fast, without going stale.</h2><p>All values are in seconds. Set a lifetime to 0 to disable that cache.</p></div><label className="as-toggle"><input type="checkbox" checked={draft.public_cache_enabled} disabled={!!busy} onChange={e => update("public_cache_enabled", e.target.checked)} /><span /><b>Public data cache</b></label></div>
      <div className="as-fields">{fields.map(field => <label className="as-field" key={field.key}><span><strong>{field.label}</strong><small>{field.note}</small></span><div><input type="number" min={0} max={field.max} step={1} value={Number(draft[field.key])} disabled={!!busy} onChange={e => update(field.key, Number(e.target.value))} aria-label={`${field.label} seconds`} /><small>0–{field.max}s</small></div></label>)}</div>
      <p className="as-hint">The public-cache switch covers tours, reels, Host landing data, site metadata and the Host leaderboard. Authentication, payments, checkout and private Host requests always remain uncached. Browser previews always refresh from the server.</p>
      <div className="as-save"><button className="as-primary" onClick={save} disabled={!!busy || !dirty}>{busy === "save" ? "Saving…" : "Save settings →"}</button><button onClick={() => { setBusy("reload"); void reload().catch(e => setNotice({ text: e.message, error: true })).finally(() => setBusy("")); }} disabled={!!busy}>Reload saved settings</button><small>{dirty ? "You have unsaved changes." : current.settings.updated_at ? `Last saved ${new Date(current.settings.updated_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST${current.settings.updated_by ? ` by ${current.settings.updated_by}` : ""}` : "Using default settings."}</small></div>
    </section>
    {notice && <p className={`as-notice ${notice.error ? "error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
    <AdminPageCache disabled={!!busy || dirty} publicCacheEnabled={current.settings.public_cache_enabled} maintenanceEnabled={current.settings.maintenance_enabled} />
    <section className="as-card"><p className="as-eyebrow">REFRESH ON DEMAND</p><h2>Clear the right cache.</h2><p>Save any pending settings before clearing caches. Content is rebuilt lazily, not all at once.</p><div className="as-purges">{purges.map(item => <div key={item.scope}><strong>{item.label}</strong><p>{item.note}</p><button onClick={() => purge(item.scope)} disabled={!!busy || dirty}>{busy === item.scope ? "Refreshing…" : "Refresh →"}</button></div>)}</div></section>
    <section className="as-card"><p className="as-eyebrow">WORDPRESS MODULES</p><h2>Generated files & page cache.</h2><div className="as-modules"><div><h3>Generated itinerary PDFs</h3><p>{current.capabilities.pdf ? "Uses the installed Tripanza PDF module. All-tour clearing runs in small batches." : "Unavailable: install the Tripanza PDF cache module to enable these actions."}</p><label>Tour ID<input type="number" min="1" step="1" value={tourId} disabled={!!busy} onChange={e => setTourId(e.target.value)} /></label><button disabled={!!busy || dirty || !current.capabilities.pdf || !Number.isInteger(Number(tourId)) || Number(tourId) <= 0} onClick={() => purge("pdf")}>{busy === "pdf" ? "Clearing…" : "Clear this tour PDF cache"}</button><button disabled={!!busy || dirty || !current.capabilities.pdf} onClick={() => purge("pdf_all")}>{busy === "pdf_all" ? "Clearing in batches…" : "Clear all generated PDF caches"}</button></div><div><h3>WordPress page cache</h3><p>{current.capabilities.page_cache ? "A supported WordPress page-cache plugin was detected (LiteSpeed, WP Rocket or W3 Total Cache)." : "No supported page-cache plugin detected."}</p><button disabled={!!busy || dirty || !current.capabilities.page_cache} onClick={() => purge("page_cache")}>{busy === "page_cache" ? "Requesting purge…" : "Purge WordPress page cache"}</button><p className="as-hint">External CDN caches, browser HTTP caches and third-party plugin settings must be managed in their own dashboards. This page never flushes all WordPress objects or authentication transients.</p></div></div></section>
    <AdminOperations />
  </main>;
}
