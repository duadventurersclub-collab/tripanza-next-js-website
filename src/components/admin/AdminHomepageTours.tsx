"use client";

import { useEffect, useState } from "react";
import { HOMEPAGE_SECTIONS, normalizeHomepageSections, type HomepageCatalog, type HomepageSection, type HomepageSectionRule } from "@/lib/homepage-sections";
import type { SiteSettings } from "@/lib/site-settings-types";

export default function AdminHomepageTours({ draft, update, disabled, supported, save, busy, dirty }: {
  draft: SiteSettings;
  update: <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => void;
  disabled: boolean;
  supported: boolean;
  save: () => void;
  busy: boolean;
  dirty: boolean;
}) {
  const [catalog, setCatalog] = useState<HomepageCatalog | null>(null);
  const [error, setError] = useState("");
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!supported) return;
    const controller = new AbortController();
    fetch("/api/admin/homepage-catalog", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load published tours.");
        if (!Array.isArray(data.tours) || !Array.isArray(data.taxonomies)) throw new Error("Invalid tour catalogue.");
        return data as HomepageCatalog;
      })
      .then(data => { setCatalog(data); setError(""); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load published tours."); });
    return () => controller.abort();
  }, [supported, retry]);

  const rules = normalizeHomepageSections(draft.homepage_sections);
  const setRule = (key: HomepageSection, change: Partial<HomepageSectionRule>) => update("homepage_sections", {
    ...rules, [key]: { ...rules[key], ...change },
  });

  return <section className="as-card as-homepage" id="homepage-tours"><p className="as-eyebrow">HOMEPAGE TOUR PLACEMENT</p><h2>Choose what visitors see.</h2>
    <p>Set each section to automatic, a hand-picked list of up to 12 published trips, or a WordPress tour category (up to 12 newest matching trips). The current layout stays the same. Sections still require their usual content (for example, dates for Leaving soon, videos for reels, and offers for Deal drop). Leaving soon and budget trips keep their date/price order. Search and View all trips still show the full catalogue.</p>
    {!supported && <p className="as-notice error">Update Tripanza Site Controls in WordPress to v1.4.0 to use homepage tour placement.</p>}
    {supported && error && <p className="as-notice error">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {supported && !catalog && !error && <p>Loading published tours and categories…</p>}
    {supported && catalog && <div className="as-homepage-grid">{(Object.keys(HOMEPAGE_SECTIONS) as HomepageSection[]).map(key => {
      const rule = rules[key];
      const taxonomy = catalog.taxonomies.find(item => item.slug === rule.taxonomy);
      const query = (searches[key] || "").trim().toLowerCase();
      const matches = catalog.tours.filter(tour => !rule.slugs.includes(tour.slug) && `${tour.title} ${tour.slug}`.toLowerCase().includes(query)).slice(0, 20);
      return <div className="as-homepage-rule" key={key}>
        <label><strong>{HOMEPAGE_SECTIONS[key]}</strong><select aria-label={`${HOMEPAGE_SECTIONS[key]} source`} value={rule.mode} disabled={disabled} onChange={event => setRule(key, { mode: event.target.value as HomepageSectionRule["mode"] })}>
          <option value="automatic">Automatic</option><option value="manual">Choose tours</option><option value="category">By category</option>
        </select></label>
        {rule.mode === "manual" && <div className="as-homepage-manual">
          <ol>{rule.slugs.map((slug, index) => <li key={slug}><span>{catalog.tours.find(tour => tour.slug === slug)?.title || slug}</span><span className="as-homepage-actions"><button type="button" aria-label={`Move ${slug} up`} disabled={disabled || index === 0} onClick={() => { const next = [...rule.slugs]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; setRule(key, { slugs: next }); }}>↑</button><button type="button" aria-label={`Move ${slug} down`} disabled={disabled || index === rule.slugs.length - 1} onClick={() => { const next = [...rule.slugs]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; setRule(key, { slugs: next }); }}>↓</button><button type="button" aria-label={`Remove ${slug}`} disabled={disabled} onClick={() => setRule(key, { slugs: rule.slugs.filter(value => value !== slug) })}>×</button></span></li>)}</ol>
          <input aria-label={`Find tours for ${HOMEPAGE_SECTIONS[key]}`} placeholder="Find a published tour…" value={searches[key] || ""} disabled={disabled || rule.slugs.length >= 12} onChange={event => setSearches(current => ({ ...current, [key]: event.target.value }))} />
          {query && rule.slugs.length < 12 && <div className="as-homepage-results">{matches.length ? matches.map(tour => <button type="button" key={tour.id} disabled={disabled} onClick={() => { setRule(key, { slugs: [...rule.slugs, tour.slug] }); setSearches(current => ({ ...current, [key]: "" })); }}>+ {tour.title}</button>) : <small>No matching published tours.</small>}</div>}
          <small>{rule.slugs.length}/12 tours selected. Drag-free ordering uses the arrow buttons.</small>
        </div>}
        {rule.mode === "category" && <div className="as-homepage-category"><select aria-label={`${HOMEPAGE_SECTIONS[key]} taxonomy`} value={rule.taxonomy} disabled={disabled} onChange={event => setRule(key, { taxonomy: event.target.value, term: "" })}><option value="">Choose category group</option>{catalog.taxonomies.map(item => <option value={item.slug} key={item.slug}>{item.label}</option>)}</select><select aria-label={`${HOMEPAGE_SECTIONS[key]} category`} value={rule.term} disabled={disabled || !taxonomy} onChange={event => setRule(key, { term: event.target.value })}><option value="">Choose category</option>{taxonomy?.terms.map(term => <option value={term.slug} key={term.id}>{term.name}</option>)}</select><small>{rule.term ? `${catalog.tours.filter(tour => tour.terms?.[rule.taxonomy]?.some(term => term.slug === rule.term)).length} published matching tours` : "Select a category to include matching tours."}</small></div>}
      </div>;
    })}</div>}
    <div className="as-save"><button className="as-primary" type="button" onClick={save} disabled={disabled || !dirty || !catalog}>{busy ? "Saving…" : "Save homepage sections →"}</button><small>Changes appear after saving and homepage cache refresh. No booking prices or availability rules change.</small></div>
  </section>;
}
