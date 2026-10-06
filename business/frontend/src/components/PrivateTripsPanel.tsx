"use client";

import { useEffect, useState } from "react";
import { Map, Plus, Trash2, Save, Loader2, FileSpreadsheet, Globe, Calculator } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface Settings {
  sheets: { name: string; url: string; tab: string; category: "hotels" | "transport" | "activities" | "itineraries" | "other" }[];
  vendors: { name: string; url: string; notes: string }[];
  sourcePolicy: "sheets_only" | "sheets_and_vendors" | "vendors_only";
  markup: { type: "percentage" | "fixed"; value: number | null };
}
interface Status { settings: Settings; updatedAt: string | null; quotingEnabled: boolean; message: string }
const inputClass = "w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-600 disabled:opacity-60";
const cardClass = "rounded-2xl border border-slate-200 bg-white/60 p-5 space-y-4";
const buttonClass = "inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:bg-slate-100 disabled:opacity-50";
export default function PrivateTripsPanel() {
  const { user } = useAuth();
  const canEdit = user?.role === "super_admin";
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sampleCost, setSampleCost] = useState("10000");
  async function load() {
    const response = await apiFetch("/api/admin/private-trips");
    if (!response.ok) throw new Error("Could not load private-trip settings.");
    const data: Status = await response.json(); setStatus(data); setDraft(data.settings); setError("");
  }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  function change(next: Settings) { setDraft(next); setNotice(""); }
  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/admin/private-trips", { method: "PUT", body: JSON.stringify(draft) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not save settings.");
      setStatus(data); setDraft(data.settings); setNotice("Settings saved for later. Automatic private-trip quotes remain inactive.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save settings."); }
    finally { setBusy(false); }
  }
  const dirty = !!draft && !!status && JSON.stringify(draft) !== JSON.stringify(status.settings);
  const base = Number(sampleCost);
  const previewValid = sampleCost.trim() !== "" && Number.isFinite(base) && base >= 0 && base <= 100000000 && draft?.markup.value !== null && draft?.markup.value !== undefined && Number.isFinite(draft.markup.value) && draft.markup.value >= 0 && (draft.markup.type !== "percentage" || draft.markup.value <= 100);
  const fee = previewValid && draft ? draft.markup.type === "percentage" ? Math.round(base * draft.markup.value! / 100 * 100) / 100 : draft.markup.value! : 0;
  const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
  return <div className="max-w-6xl mx-auto space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Map size={21} className="text-brand-700" />Private trips</h1><p className="text-sm text-slate-600 mt-1">Prepare pricing sources for trips customized to a customer&apos;s dates and requirements.</p></div><span className="rounded-full bg-brand-600/10 px-3 py-1.5 text-xs text-brand-700">Automatic quotes inactive</span></div>
    <div className="rounded-xl border border-brand-600/20 bg-brand-600/5 p-4 text-sm text-slate-700"><p>{status?.message || "Save your sheet links, trusted vendors, and markup here whenever you are ready. These settings do not activate quoting."}</p><p className="mt-2 text-xs text-slate-600">Group trips continue to use the selected tour links and fixed departure information in Website knowledge.</p></div>
    {error && <div role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300">{error}{!draft && <button className="ml-3 underline" onClick={() => load().catch(e => setError(e.message))}>Retry</button>}</div>}
    {!draft ? <p className="text-sm text-slate-600">{error ? "Settings could not be loaded." : "Loading private-trip settings…"}</p> : <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-6">
      <fieldset disabled={!canEdit || busy} className="min-w-0 space-y-6">
        <section className={cardClass}>
          <div className="flex flex-wrap justify-between items-start gap-3"><div><h2 className="font-semibold text-slate-900 flex items-center gap-2"><FileSpreadsheet size={18} className="text-brand-700" />Google Sheets</h2><p className="text-sm text-slate-600 mt-2">Add separate workbooks or tabs for hotels, transport, activities, and itineraries. You can fill these in later.</p></div><button type="button" disabled={draft.sheets.length >= 30} className={buttonClass} onClick={() => change({ ...draft, sheets: [...draft.sheets, { name: "", url: "", tab: "", category: "other" }] })}><Plus size={15} />Add sheet</button></div>
          {!draft.sheets.length && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No sheets added yet.</p>}
          {draft.sheets.map((sheet, index) => {
            const edit = (patch: Partial<Settings["sheets"][number]>) => change({ ...draft, sheets: draft.sheets.map((s, i) => i === index ? { ...s, ...patch } : s) });
            return <div key={index} className="rounded-xl border border-slate-200 p-4 space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-medium text-slate-700">Sheet {index + 1}</h3><button type="button" aria-label={`Remove sheet ${index + 1}`} className="text-slate-600 hover:text-red-300 p-2" onClick={() => change({ ...draft, sheets: draft.sheets.filter((_, i) => i !== index) })}><Trash2 size={16} /></button></div><div className="grid sm:grid-cols-2 gap-3"><label className="text-xs text-slate-600 space-y-2 block">Name<input required maxLength={100} className={inputClass} value={sheet.name} onChange={e => edit({ name: e.target.value })} placeholder="Manali hotel rates" /></label><label className="text-xs text-slate-600 space-y-2 block">Data type<select className={inputClass} value={sheet.category} onChange={e => edit({ category: e.target.value as typeof sheet.category })}>{["hotels", "transport", "activities", "itineraries", "other"].map(v => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select></label></div><label className="text-xs text-slate-600 space-y-2 block">Google Sheets link<input required type="url" maxLength={2048} className={inputClass} value={sheet.url} onChange={e => edit({ url: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…/edit" /></label><label className="text-xs text-slate-600 space-y-2 block">Worksheet tab (optional)<input maxLength={100} className={inputClass} value={sheet.tab} onChange={e => edit({ tab: e.target.value })} placeholder="Hotels" /></label></div>;
          })}
          <p className="text-xs text-slate-500">Links are saved without fetching data. Sheet access and column mapping will be configured after the rate tables are available. Keep API keys and passwords out of these fields.</p>
        </section>
        <section className={cardClass}>
          <div className="flex flex-wrap justify-between items-start gap-3"><div><h2 className="font-semibold text-slate-900 flex items-center gap-2"><Globe size={18} className="text-brand-700" />Trusted vendors</h2><p className="text-sm text-slate-600 mt-2">List companies you approve for private-trip offers.</p></div><button type="button" disabled={draft.vendors.length >= 30} className={buttonClass} onClick={() => change({ ...draft, vendors: [...draft.vendors, { name: "", url: "", notes: "" }] })}><Plus size={15} />Add vendor</button></div>
          <label className="text-xs text-slate-600 space-y-2 block">Preferred pricing sources<select className={inputClass} value={draft.sourcePolicy} onChange={e => change({ ...draft, sourcePolicy: e.target.value as Settings["sourcePolicy"] })}><option value="sheets_only">My Google Sheets only</option><option value="sheets_and_vendors">Compare my sheets with trusted vendors</option><option value="vendors_only">Trusted vendors only</option></select></label>
          {!draft.vendors.length && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No vendors added yet.</p>}
          {draft.vendors.map((vendor, index) => {
            const edit = (patch: Partial<Settings["vendors"][number]>) => change({ ...draft, vendors: draft.vendors.map((v, i) => i === index ? { ...v, ...patch } : v) });
            return <div key={index} className="rounded-xl border border-slate-200 p-4 space-y-3"><div className="flex justify-between items-center"><h3 className="text-sm font-medium text-slate-700">Vendor {index + 1}</h3><button type="button" aria-label={`Remove vendor ${index + 1}`} className="text-slate-600 hover:text-red-300 p-2" onClick={() => change({ ...draft, vendors: draft.vendors.filter((_, i) => i !== index) })}><Trash2 size={16} /></button></div><div className="grid sm:grid-cols-2 gap-3"><label className="text-xs text-slate-600 space-y-2 block">Company name<input required maxLength={100} className={inputClass} value={vendor.name} onChange={e => edit({ name: e.target.value })} /></label><label className="text-xs text-slate-600 space-y-2 block">Company website<input required type="url" maxLength={2048} className={inputClass} value={vendor.url} onChange={e => edit({ url: e.target.value })} placeholder="https://vendor.com" /></label></div><label className="text-xs text-slate-600 space-y-2 block">Services or conditions (optional)<textarea rows={2} maxLength={1000} className={inputClass} value={vendor.notes} onChange={e => edit({ notes: e.target.value })} placeholder="Destinations served, hotel categories, transport options…" /></label></div>;
          })}
          <p className="text-xs text-slate-500">Saving a vendor does not connect its booking system or verify availability. Comparing live offers will require a supported vendor connection, with matching dates, travellers, inclusions, taxes, and cancellation terms.</p>
        </section>
        <section className={cardClass}>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Calculator size={18} className="text-brand-700" />Markup</h2><p className="text-sm text-slate-600">Apply markup once to the total private-trip base cost. Fixed markup is in INR per quote. Leave the value empty to configure it later.</p>
          <div className="grid sm:grid-cols-2 gap-3"><label className="text-xs text-slate-600 space-y-2 block">Markup type<select className={inputClass} value={draft.markup.type} onChange={e => change({ ...draft, markup: { ...draft.markup, type: e.target.value as Settings["markup"]["type"] } })}><option value="percentage">Percentage of base cost</option><option value="fixed">Fixed amount per quote (INR)</option></select></label><label className="text-xs text-slate-600 space-y-2 block">{draft.markup.type === "percentage" ? "Markup (%)" : "Markup (INR)"}<input type="number" min={0} max={draft.markup.type === "percentage" ? 100 : 10000000} step="0.01" className={inputClass} value={draft.markup.value ?? ""} onChange={e => change({ ...draft, markup: { ...draft.markup, value: e.target.value === "" ? null : Number(e.target.value) } })} placeholder="Set later" /></label></div>
        </section>
      </fieldset>
      <section className={cardClass}><h2 className="font-semibold text-slate-900">Sample calculation</h2><p className="text-xs text-slate-600">Preview only; this does not send a quote. Uses the markup currently shown above.</p><label className="text-xs text-slate-600 space-y-2 block max-w-sm">Sample base cost (INR)<input type="number" min={0} max={100000000} step="0.01" className={inputClass} value={sampleCost} onChange={e => setSampleCost(e.target.value)} /></label>{previewValid ? <div className="grid sm:grid-cols-3 gap-4 text-sm"><div><p className="text-slate-600">Base cost</p><p className="mt-1 text-slate-900">{money(base)}</p></div><div><p className="text-slate-600">Markup</p><p className="mt-1 text-slate-900">{money(fee)}</p></div><div><p className="text-slate-600">Selling price</p><p className="mt-1 text-brand-700 font-semibold">{money(Math.round((base + fee) * 100) / 100)}</p></div></div> : <p className="text-xs text-slate-500">Enter a base cost and markup to see the calculation.</p>}</section>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-600">{canEdit ? dirty ? "You have unsaved changes." : status?.updatedAt ? `Last saved ${new Date(status.updatedAt).toLocaleString()}` : "No settings saved yet. You can return to this page later." : "The workspace owner can update these settings."}</p>{canEdit && <button type="submit" disabled={busy || !dirty} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save private-trip settings</button>}</div>
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    </form>}
  </div>;
}
