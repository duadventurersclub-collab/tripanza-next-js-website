"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicCachePage } from "@/lib/page-cache";

type Action = "clear" | "generate";

async function readJson(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status}).`);
  return data;
}

export default function AdminPageCache({ disabled, publicCacheEnabled, maintenanceEnabled }: { disabled: boolean; publicCacheEnabled: boolean; maintenanceEnabled: boolean }) {
  const [pages, setPages] = useState<PublicCachePage[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [progress, setProgress] = useState("");
  const filtered = useMemo(() => pages.filter(page => `${page.title} ${page.path}`.toLowerCase().includes(query.toLowerCase().trim())), [pages, query]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  async function loadPages() {
    setLoading(true);
    setNotice(null);
    try {
      const data = await readJson(await fetch("/api/admin/page-cache", { cache: "no-store", signal: AbortSignal.timeout(60_000) }));
      if (!Array.isArray(data.pages)) throw new Error("The page list was incomplete.");
      setPages(data.pages);
      setSelected(previous => previous.filter(path => data.pages.some((page: PublicCachePage) => page.path === path)));
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "Could not load pages.", error: true }); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadPages(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function run(action: Action, targets: PublicCachePage[]) {
    if (!targets.length || busy || disabled) return;
    if (action === "generate" && (!publicCacheEnabled || maintenanceEnabled)) return;
    const label = targets.length === pages.length ? "all eligible public pages" : `${targets.length} selected page${targets.length === 1 ? "" : "s"}`;
    if (action === "clear" && !window.confirm(`Clear cache for ${label}? Content is not deleted and will rebuild on the next visit.`)) return;
    setBusy(true);
    setNotice(null);
    setProgress(`Clearing 0/${targets.length} pages…`);
    let cleared = 0;
    let warmed = 0;
    const failures: string[] = [];
    try {
      for (let offset = 0; offset < targets.length; offset += 50) {
        const batch = targets.slice(offset, offset + 50);
        await readJson(await fetch("/api/admin/page-cache", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: batch.map(page => page.path) }), signal: AbortSignal.timeout(30_000) }));
        cleared += batch.length;
        setProgress(`Clearing ${cleared}/${targets.length} pages…`);
      }
      if (action === "generate") {
        // Anonymous same-origin GETs generate shared HTML, never an admin's
        // personalized version. Finish each response so ISR can be persisted.
        let index = 0;
        const worker = async () => {
          while (index < targets.length) {
            const page = targets[index++];
            try {
              const response = await fetch(page.path, { credentials: "omit", headers: { Accept: "text/html" }, signal: AbortSignal.timeout(30_000) });
              const html = await response.text();
              if (!response.ok || !response.headers.get("content-type")?.includes("text/html") || !html.includes("<html")) throw new Error("Page did not render as public HTML");
              warmed++;
            } catch { failures.push(page.path); }
            setProgress(`Generated ${warmed + failures.length}/${targets.length} pages…`);
          }
        };
        await Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker));
      }
      setNotice(failures.length
        ? { text: `Cleared ${cleared} pages; generated ${warmed}. Could not generate: ${failures.slice(0, 5).join(", ")}${failures.length > 5 ? ` and ${failures.length - 5} more` : ""}.`, error: true }
        : { text: action === "generate" ? `Generated ${warmed} public pages. Their normal cache lifetimes still apply.` : `Cleared ${cleared} public pages. They will regenerate on the next visit.` });
    } catch (error) { setNotice({ text: `${error instanceof Error ? error.message : "Operation failed."} ${cleared} pages were cleared before stopping.`, error: true }); }
    finally { setBusy(false); setProgress(""); }
  }

  const selectedPages = pages.filter(page => selectedSet.has(page.path));
  const generateDisabled = disabled || busy || loading || !publicCacheEnabled || maintenanceEnabled;
  return <section className="as-card as-page-cache">
    <p className="as-eyebrow">PUBLIC PAGE CACHE</p><h2>Generate or clear individual pages.</h2>
    <p>Published trips come from WordPress; the other entries are public Next.js pages. Private account, booking, checkout, Host and admin routes are deliberately excluded. Generating visits each URL anonymously to warm its eligible Next.js caches; external CDN caches are not controlled here.</p>
    {!publicCacheEnabled && <p className="as-notice error">Enable and save Public data cache before generating pages. You can still clear existing entries.</p>}
    {maintenanceEnabled && <p className="as-notice error">Turn off maintenance mode before generating pages so anonymous requests cannot cache the maintenance response.</p>}
    <div className="as-page-cache__toolbar"><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search page or URL" aria-label="Search cache pages" disabled={busy} /><button type="button" onClick={() => void loadPages()} disabled={busy || loading}>{loading ? "Loading…" : "Refresh page list"}</button></div>
    <div className="as-page-cache__actions"><span>{pages.length} public pages · {selected.length} selected</span><button type="button" disabled={busy || loading || !filtered.length} onClick={() => setSelected(previous => [...new Set([...previous, ...filtered.map(page => page.path)])])}>Select shown</button><button type="button" disabled={busy || loading || !pages.length} onClick={() => setSelected(pages.map(page => page.path))}>Select all</button><button type="button" disabled={busy || !selected.length} onClick={() => setSelected([])}>Clear selection</button></div>
    <div className="as-page-cache__actions"><button type="button" disabled={generateDisabled || !pages.length} onClick={() => void run("generate", pages)}>Generate all pages</button><button type="button" disabled={generateDisabled || !selected.length} onClick={() => void run("generate", selectedPages)}>Generate selected</button><button type="button" disabled={disabled || busy || loading || !pages.length} onClick={() => void run("clear", pages)}>Clear all page caches</button><button type="button" disabled={disabled || busy || !selected.length} onClick={() => void run("clear", selectedPages)}>Clear selected</button></div>
    {progress && <p role="status" className="as-hint">{progress}</p>}{notice && <p role={notice.error ? "alert" : "status"} className={`as-notice ${notice.error ? "error" : ""}`}>{notice.text}</p>}
    <div className="as-page-cache__list">{filtered.map(page => <div className="as-page-cache__row" key={page.path}><label><input type="checkbox" checked={selectedSet.has(page.path)} disabled={busy} onChange={event => setSelected(previous => event.target.checked ? [...previous, page.path] : previous.filter(path => path !== page.path))} /><span><strong>{page.title}</strong><small>{page.path} · {page.kind === "tour" ? "Tour detail" : "Public page"}</small></span></label><div><button type="button" disabled={generateDisabled} onClick={() => void run("generate", [page])}>Generate</button><button type="button" disabled={disabled || busy} onClick={() => void run("clear", [page])}>Clear</button></div></div>)}{!loading && !filtered.length && <p>{pages.length ? "No pages match your search." : "No public pages available. Refresh the page list to retry."}</p>}</div>
  </section>;
}
