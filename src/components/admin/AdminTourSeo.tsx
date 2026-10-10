"use client";

import { useEffect, useState } from "react";
import type { HomepageCatalog } from "@/lib/homepage-sections";
import { normalizeTourSeo, type AdminTourSeoConfig, type TourSeoRule } from "@/lib/tour-seo-types";

const blankRule: TourSeoRule = { title: "", description: "", image_url: "", noindex: false };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseSaved(value: unknown): AdminTourSeoConfig {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (typeof record.revision !== "string") throw new Error("Invalid SEO settings response.");
  return { revision: record.revision, ...normalizeTourSeo(value) };
}

export default function AdminTourSeo({ supported }: { supported: boolean }) {
  const [catalog, setCatalog] = useState<HomepageCatalog | null>(null);
  const [saved, setSaved] = useState<AdminTourSeoConfig | null>(null);
  const [draft, setDraft] = useState<AdminTourSeoConfig | null>(null);
  const [selectedId, setSelectedId] = useState(0);
  const [search, setSearch] = useState("");
  const [oldSlug, setOldSlug] = useState("");
  const [targetSlug, setTargetSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!supported) return;
    const controller = new AbortController();
    Promise.all([
      fetch("/api/admin/homepage-catalog", { cache: "no-store", signal: controller.signal }),
      fetch("/api/admin/seo", { cache: "no-store", signal: controller.signal }),
    ]).then(async ([catalogResponse, seoResponse]) => {
      const [catalogData, seoData] = await Promise.all([catalogResponse.json(), seoResponse.json()]);
      if (!catalogResponse.ok) throw new Error(catalogData.message || "Could not load published tours.");
      if (!seoResponse.ok) throw new Error(seoData.message || "Could not load tour SEO settings.");
      if (!Array.isArray(catalogData.tours)) throw new Error("Invalid tour catalogue.");
      return { catalog: catalogData as HomepageCatalog, seo: parseSaved(seoData) };
    }).then(data => {
      setCatalog(data.catalog); setSaved(data.seo); setDraft(data.seo);
      setSelectedId(current => current || data.catalog.tours[0]?.id || 0);
      setError("");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load SEO settings."); });
    return () => controller.abort();
  }, [supported, retry]);

  const tour = catalog?.tours.find(item => item.id === selectedId);
  const rule = draft?.tours[String(selectedId)] || blankRule;
  const dirty = !!draft && !!saved && JSON.stringify({ tours: draft.tours, redirects: draft.redirects }) !== JSON.stringify({ tours: saved.tours, redirects: saved.redirects });
  const matches = catalog?.tours.filter(item => `${item.title} ${item.slug}`.toLowerCase().includes(search.trim().toLowerCase())) || [];

  function updateRule(change: Partial<TourSeoRule>) {
    if (!draft || !selectedId) return;
    const next = { ...rule, ...change };
    const tours = { ...draft.tours };
    if (next.title || next.description || next.image_url || next.noindex) tours[String(selectedId)] = next;
    else delete tours[String(selectedId)];
    setDraft({ ...draft, tours }); setNotice("");
  }

  function addRedirect() {
    if (!draft || !catalog) return;
    const from = oldSlug.trim().toLowerCase();
    if (!slugPattern.test(from)) return setError("Enter only the old tour slug, such as old-goa-trip.");
    if (!targetSlug || !catalog.tours.some(item => item.slug === targetSlug)) return setError("Choose a published destination tour.");
    if (from === targetSlug || catalog.tours.some(item => item.slug === from)) return setError("The old slug must not be an active tour or the destination.");
    if (draft.redirects.some(item => item.from === from)) return setError("That old slug already has a redirect.");
    if (draft.redirects.length >= 300) return setError("At most 300 redirects can be saved.");
    setDraft({ ...draft, redirects: [...draft.redirects, { from, to: targetSlug }] });
    setOldSlug(""); setTargetSlug(""); setError(""); setNotice("");
  }

  async function save() {
    if (!draft || !dirty) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/seo", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Could not save SEO settings.");
      const next = parseSaved(data);
      setSaved(next); setDraft(next);
      setNotice("Saved. Tour metadata and redirects will update after cache refresh; search engines may take longer to recrawl.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save SEO settings."); }
    finally { setBusy(false); }
  }

  return <section className="as-card as-tour-seo" id="tour-seo"><p className="as-eyebrow">TOUR SEO & REDIRECTS</p><h2>Control search previews and old links.</h2><p>Optional overrides apply only to this Next.js site. Blank fields use the tour title, excerpt and featured image. WordPress SEO settings remain separate.</p>
    {!supported && <p className="as-notice error">Update Tripanza Site Controls in WordPress to v1.6.0 to manage tour SEO and redirects.</p>}
    {supported && !catalog && !error && <p>Loading published tours and SEO settings…</p>}
    {error && <p className="as-notice error" role="alert">{error} {!catalog && <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button>}</p>}
    {supported && catalog && draft && <>
      <div className="as-tour-seo__grid"><div>
        <h3>Per-tour search preview</h3>
        <label className="as-text-field">Find a published tour<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tour name or slug" disabled={busy} /></label>
        <label className="as-text-field">Tour<select value={selectedId} onChange={event => setSelectedId(Number(event.target.value))} disabled={busy}><option value={0}>Choose a tour</option>{matches.map(item => <option key={item.id} value={item.id}>{item.title} ({item.slug})</option>)}{tour && !matches.some(item => item.id === selectedId) && <option value={tour.id}>{tour.title} ({tour.slug})</option>}</select></label>
        {tour && <div className="as-tour-seo__fields">
          <label className="as-text-field">Search title<input maxLength={140} value={rule.title} disabled={busy} onChange={event => updateRule({ title: event.target.value })} placeholder={tour.title} /><small>Usually keep this concise. A custom title is used exactly as entered.</small></label>
          <label className="as-text-field">Search description<textarea maxLength={500} value={rule.description} disabled={busy} onChange={event => updateRule({ description: event.target.value })} placeholder="Leave blank to use the tour excerpt" /><small>Describe the trip naturally; search engines may choose a different snippet.</small></label>
          <label className="as-text-field">Social preview image URL<input type="url" maxLength={1000} value={rule.image_url} disabled={busy} onChange={event => updateRule({ image_url: event.target.value })} placeholder="https://…" /><small>Paste an HTTPS image URL from your WordPress Media Library. Blank uses the featured image.</small></label>
          <label className="as-toggle"><input type="checkbox" checked={rule.noindex} disabled={busy} onChange={event => updateRule({ noindex: event.target.checked })} /><span /><b>Keep this tour out of search results</b></label><small>Sets noindex and removes it from the Next.js sitemap. Existing search results disappear only after recrawling.</small>
        </div>}
      </div><div>
        <h3>Old tour URL redirects</h3><p>Use these after changing a tour slug. Only `/tours/old-slug` redirects to a currently published tour; booking and admin URLs are never redirected.</p>
        <label className="as-text-field">Old tour slug<input value={oldSlug} disabled={busy} onChange={event => setOldSlug(event.target.value)} placeholder="old-goa-trip" /></label>
        <label className="as-text-field">Destination tour<select value={targetSlug} disabled={busy} onChange={event => setTargetSlug(event.target.value)}><option value="">Choose a published tour</option>{catalog.tours.map(item => <option value={item.slug} key={item.id}>{item.title} ({item.slug})</option>)}</select></label>
        <button type="button" disabled={busy} onClick={addRedirect}>Add redirect</button>
        <ul className="as-tour-seo__redirects">{draft.redirects.map(item => <li key={item.from}><span>/tours/{item.from} → /tours/{item.to}</span><button type="button" disabled={busy} aria-label={`Remove redirect from ${item.from}`} onClick={() => setDraft({ ...draft, redirects: draft.redirects.filter(value => value.from !== item.from) })}>Remove</button></li>)}</ul>
        {!draft.redirects.length && <p>No old tour links configured.</p>}
      </div></div>
      <div className="as-save"><button type="button" className="as-primary" disabled={busy || !dirty} onClick={save}>{busy ? "Saving…" : "Save tour SEO & redirects →"}</button><small>{dirty ? "Unsaved changes." : "All changes saved."} Redirects use a permanent 308 response.</small></div>
    </>}
    {notice && <p className="as-notice" role="status">{notice}</p>}
  </section>;
}
