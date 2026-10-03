"use client";
import type { SiteSettings } from "@/lib/site-settings-types";

const switches = [
  ["ai_chat_enabled", "AI trip assistant", "Pause Kanika and its API. History deletion stays available."],
  ["reels_enabled", "Discovery & trip reels", "Hide trip videos and disable the discovery feed and Host reel APIs."],
  ["pdf_downloads_enabled", "Itinerary downloads", "Pause download forms and WordPress PDF generation without deleting PDFs."],
  ["new_bookings_enabled", "New online bookings", "Pause carts, new orders and the AI assistant (which can create bookings). Existing orders and payment verification stay available."],
] as const;
const content = [
  ["announcement_text", "Announcement text", 300, "plain text"],
  ["announcement_link", "Announcement link", 500, "/tours or https://…"],
  ["featured_tour_slugs", "Featured tours (up to 12)", 1200, "published-trip-slug, another-trip-slug"],
  ["contact_email", "Support email", 254, "hello@tripanza.com"],
  ["contact_phone", "Support phone", 25, "+918130117254"],
  ["contact_address", "Contact address", 300, "Dwarka, Delhi NCR, India"],
  ["whatsapp_number", "WhatsApp (country code + digits)", 15, "918130117254"],
  ["instagram_url", "Instagram URL", 500, "https://www.instagram.com/…"],
  ["facebook_url", "Facebook URL", 500, "https://www.facebook.com/…"],
] as const;

export default function AdminAdvancedControls({ draft, update, disabled, supported }: { draft: SiteSettings; update: <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => void; disabled: boolean; supported: boolean }) {
  const locked = disabled || !supported;
  const toggle = (key: keyof SiteSettings, label: string) => <label className="as-toggle"><input aria-label={label} type="checkbox" checked={Boolean(draft[key])} disabled={locked} onChange={e => update(key, e.target.checked)} /><span /><b>{label}</b></label>;
  return <>
    {!supported && <p className="as-notice error">Update Tripanza Site Controls to version 1.1.0 in WordPress to unlock the new controls. Existing cache and Host controls still work.</p>}
    <section className="as-card"><p className="as-eyebrow">FEATURE SWITCHES</p><h2>Only what you want live.</h2><div className="as-fields">{switches.map(([key, label, note]) => <div className="as-field" key={key}><span><strong>{label}</strong><small>{note}</small></span>{toggle(key, label)}</div>)}</div></section>
    <section className="as-card"><div className="as-section-head"><div><p className="as-eyebrow">MAINTENANCE</p><h2>A safe pause.</h2></div>{toggle("maintenance_enabled", "Maintenance mode")}</div><p>Visitors see a temporary HTTP 503 page. Verified WordPress administrators can browse normally. Sign-in, accounts, existing bookings, payments, legal policies, contact and admin recovery remain available. New bookings pause for non-admins.</p><label className="as-text-field">Visitor message<textarea aria-label="Maintenance message" maxLength={500} value={draft.maintenance_message} disabled={locked} onChange={e => update("maintenance_message", e.target.value)} /></label></section>
    <section className="as-card"><div className="as-section-head"><div><p className="as-eyebrow">WEBSITE CONTENT</p><h2>Keep the essentials current.</h2></div>{toggle("announcement_enabled", "Show announcement")}</div><p>Plain text only. Featured trips appear first on the homepage in the order entered. Contact settings update the contact page, home support links, tour inquiries and profile help.</p><div className="as-content-fields">{content.map(([key, label, max, placeholder]) => <label className="as-text-field" key={key}>{label}<input aria-label={label} maxLength={max} placeholder={placeholder} value={draft[key]} disabled={locked} onChange={e => update(key, e.target.value)} /></label>)}</div></section>
    <section className="as-card"><div className="as-section-head"><div><p className="as-eyebrow">ERROR ALERTS</p><h2>Hear when something breaks.</h2></div>{toggle("error_alerts_enabled", "Email error alerts")}</div><p>Server exceptions and critical upstream failures are classified without customer data, tokens, URLs or stack traces. Events are grouped for 30 days; at most one email is attempted per 15 minutes. Mailer acceptance is not proof of delivery.</p><label className="as-text-field">Alert recipient<input aria-label="Alert recipient" type="email" maxLength={254} placeholder="Blank uses the WordPress administrator email" value={draft.alert_email} disabled={locked} onChange={e => update("alert_email", e.target.value)} /></label><p className="as-hint">Monitoring requires the same private TRIPANZA_MONITORING_SECRET (at least 32 characters) in the Next.js server environment and WordPress wp-config.php. Never use a NEXT_PUBLIC variable. Configuration status appears below. Alerts default to off.</p></section>
  </>;
}
