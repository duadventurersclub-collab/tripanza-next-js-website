"use client";
import { useCallback, useEffect, useState } from "react";
import type { Operations } from "@/lib/site-settings-types";

function date(value: string) { return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"; }
function display(value: unknown) { return typeof value === "boolean" ? value ? "Enabled" : "Disabled" : String(value ?? "(empty)") || "(empty)"; }

export default function AdminOperations() {
  const [data, setData] = useState<Operations | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/operations", { cache: "no-store", signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Operations unavailable. Update the Site Controls plugin to 1.1.0.");
      setData(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Health checks could not complete."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => { void refresh(); }, 0); window.addEventListener("tripanza:settings-changed", refresh); return () => { clearTimeout(timer); window.removeEventListener("tripanza:settings-changed", refresh); }; }, [refresh]);
  const d = data?.diagnostics;
  return <>
    <section className="as-card"><div className="as-section-head"><div><p className="as-eyebrow">SYSTEM HEALTH & CACHE DIAGNOSTICS</p><h2>Know what is running.</h2></div><button disabled={busy} onClick={() => void refresh()}>{busy ? "Checking…" : "Run health checks"}</button></div>
      {error && <p className="as-notice error" role="alert">{error} Previous results, if shown, are not fresh.</p>}
      {data && <><p>Checked {date(data.checked_at)}. Measurements describe this request, not continuous uptime or cache hit-rate monitoring.</p><dl className="as-health-grid"><div><dt>WordPress connection</dt><dd>{d ? `${d.response_ms} ms` : "Connected"}</dd></div><div><dt>Database check</dt><dd>{data.health.database ? "Passed" : "Failed"}</dd></div><div><dt>WordPress / PHP</dt><dd>{data.health.wordpress_version} / {data.health.php_version}</dd></div><div><dt>Next.js</dt><dd>{d?.next_version || "Not reported"}</dd></div><div><dt>Upstream cache / age</dt><dd>{d?.upstream_cache} / {d?.upstream_age}</dd></div><div><dt>Fixed-URL settings cache</dt><dd>{d?.stale_settings === true ? "Stale — upstream bypass rules needed" : d?.stale_settings === false ? "Matches saved settings" : "Check unavailable"}</dd></div><div><dt>Live public / saved revision</dt><dd>{d?.public_revision || "Unavailable"}<br />{d?.saved_revision}</dd></div><div><dt>Error ingestion</dt><dd>{data.health.monitoring_configured && d?.monitoring_configured ? "Configured on both servers (shared value must match)" : "Setup required: private secret on both servers"}</dd></div></dl><p className="as-hint">The app uses a unique live-settings URL to bypass stale configuration. This does not fix CDN rules for other endpoints. Exclude admin, settings, authentication, checkout, payment and private Host routes from upstream caching. No precise object counts or hit rates are invented.</p><h3>Tripanza plugins</h3><ul className="as-plugins">{data.health.plugins.map((plugin, index) => <li key={`${plugin.name}-${index}`}><strong>{plugin.name}</strong><span>{plugin.version} · {plugin.active ? "Active" : "Inactive"}</span></li>)}</ul></>}
    </section>
    <section className="as-card"><p className="as-eyebrow">ADMIN ACTIVITY</p><h2>Changes, with context.</h2><p>The latest 100 settings saves and cache operations, including the administrator and old/new values. Only administrators can read this history.</p><div className="as-history">{data?.audit.length ? data.audit.map((event, index) => <details key={`${event.at}-${index}`}><summary><strong>{event.action.replaceAll("_", " ")}</strong><span>{event.actor || `User ${event.user_id}`} · {date(event.at)}</span></summary>{Object.keys(event.changes || {}).length ? <dl>{Object.entries(event.changes!).map(([key, change]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{display(change.from)} → {display(change.to)}</dd></div>)}</dl> : <p>No field-level changes recorded for this event.</p>}</details>) : <p>{data ? "No activity recorded yet." : "Run health checks to load activity."}</p>}</div></section>
    <section className="as-card"><p className="as-eyebrow">OPERATIONAL ERRORS</p><h2>Issues, without personal data.</h2><div className="as-history">{data?.errors.length ? data.errors.map((event, index) => <div key={index}><h3>{event.area} / {event.code.replaceAll("_", " ")}</h3><p>{event.count} occurrences · First {date(event.first_at)} · Latest {date(event.last_at)}</p>{event.mail_status && <p>Last mail attempt: {event.mail_status.replaceAll("_", " ")}</p>}</div>) : <p>{data ? "No recorded errors in the last 30 days. This does not prove there were no errors; verify monitoring configuration above." : "Run health checks to load errors."}</p>}</div></section>
  </>;
}
