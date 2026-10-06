"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, RefreshCw, FileText, Image, Video, BookOpen, ArrowUpRight, CheckCircle2, AlertCircle, Search, Link2, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Status {
  enabled: boolean; website: string; aiConfigured: boolean; model: string; syncing: boolean;
  syncHours: number; lastSuccessAt: string | null; error: string | null;
  maxTours: number;
  sources: { slug: string; url: string; indexed: boolean; error: string | null }[];
  tours: { slug: string; title: string; url: string; detailFetchedAt: string | null }[];
}
interface Preview {
  title: string; url: string; fetchedAt: string;
  facts: { id: string; text: string }[];
  accommodation: { url: string; caption: string }[];
  photos: { url: string }[]; videos: { url: string }[]; pdf: { url: string };
}
export default function WebsiteKnowledgePanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(""); const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingTour, setLoadingTour] = useState("");
  const [links, setLinks] = useState(""); const [notice, setNotice] = useState("");
  const linksInitialized = useRef(false);
  const previewRequest = useRef(0);
  async function load() {
    const response = await apiFetch("/api/admin/website");
    if (!response.ok) throw new Error("Could not load website status.");
    const data: Status = await response.json();
    setStatus(data);
    if (!linksInitialized.current) {
      setLinks(data.sources.map(source => source.url).join("\n"));
      linksInitialized.current = true;
    }
  }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (!status?.syncing) return;
    const timer = setInterval(() => { load().catch(e => setError(e.message)); }, 5000);
    return () => clearInterval(timer);
  }, [status?.syncing]);
  async function sync() {
    setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/admin/website/sync", { method: "POST", body: JSON.stringify({}) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Synchronization failed.");
      setStatus(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Synchronization failed."); await load().catch(() => {}); }
    finally { setBusy(false); }
  }
  async function saveLinks() {
    setBusy(true); setError(""); setNotice("");
    previewRequest.current++; setLoadingTour("");
    try {
      const urls = links.split(/\r?\n/).map(link => link.trim()).filter(Boolean);
      const response = await apiFetch("/api/admin/website/sources", { method: "PUT", body: JSON.stringify({ urls }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not save tour links.");
      setStatus(data); setLinks(data.sources.map((source: Status["sources"][number]) => source.url).join("\n"));
      setPreview(null); setNotice(urls.length ? "Tour links saved. Only your selected tours will be indexed." : "Tour links cleared. The bot has no approved tours to use.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save tour links."); }
    finally { setBusy(false); }
  }
  async function inspect(slug: string) {
    const request = ++previewRequest.current;
    setLoadingTour(slug); setError(""); setPreview(null);
    try {
      const response = await apiFetch(`/api/admin/website/tours/${encodeURIComponent(slug)}`);
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Tour unavailable.");
      if (request === previewRequest.current) setPreview(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Tour unavailable."); }
    finally { if (request === previewRequest.current) setLoadingTour(""); }
  }
  const tours = status?.tours.filter(t => `${t.title} ${t.slug}`.toLowerCase().includes(query.toLowerCase())) || [];
  const enteredLinks = links.split(/\r?\n/).map(link => link.trim()).filter(Boolean);
  const dirty = !!status && enteredLinks.join("\n") !== status.sources.map(source => source.url).join("\n");
  return <div className="max-w-6xl mx-auto space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Globe className="w-5 h-5 text-brand-700" />Website knowledge</h1><p className="text-sm text-slate-600 mt-1">Your website is the source for trip replies and media.</p></div>
      <button onClick={sync} disabled={busy || status?.syncing || !status?.enabled || !status.sources.length || dirty} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${status?.syncing ? "animate-spin" : ""}`} />{status?.syncing ? "Indexing…" : "Refresh selected tours"}</button>
    </div>
    {(error || status?.error) && <div role="alert" className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-300 flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error || status?.error}</div>}
    <form onSubmit={event => { event.preventDefault(); saveLinks(); }} className="rounded-2xl border border-slate-200 bg-white/60 p-5 space-y-4">
      <div><h2 className="font-semibold text-slate-900 flex items-center gap-2"><Link2 className="w-4 h-4 text-brand-700" />Tour links to index</h2><p id="tour-links-help" className="text-sm text-slate-600 mt-2">Paste one tour URL per line. The bot uses only the tours you save here, including their itineraries and accommodation. Remove a link and save to exclude that tour.</p></div>
      <div><label htmlFor="tour-links" className="block text-xs font-medium text-slate-700 mb-2">Selected tour URLs</label><textarea id="tour-links" aria-describedby="tour-links-help" rows={5} value={links} onChange={event => { setLinks(event.target.value); setNotice(""); }} disabled={busy || !status} spellCheck={false} placeholder={`${status?.website || "https://tripanza.com"}/tour/your-tour-slug/`} className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600 disabled:opacity-50" /></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{enteredLinks.length} links · Up to {status?.maxTours || 200} tours. An empty list disables tour answers.</p><button type="submit" disabled={busy || !status || !dirty} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"><Save className="w-4 h-4" />{busy ? "Saving…" : "Save and index links"}</button></div>
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      {dirty && <p className="text-xs text-brand-700">You have unsaved changes. Save to update the bot&apos;s tour selection.</p>}
      {!!status?.sources.length && <div className="space-y-2 border-t border-slate-200 pt-4">{status.sources.map(source => <div key={source.slug} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-xs"><span className={`shrink-0 ${source.error ? "text-red-300" : source.indexed ? "text-emerald-700" : "text-brand-700"}`}>{source.error ? "Could not index" : source.indexed ? "Indexed" : "Pending"}</span><div className="min-w-0 flex-1"><a href={source.url} target="_blank" rel="noreferrer" className="text-slate-600 break-all hover:text-brand-700">{source.url}</a>{source.error && <p className="text-red-300 mt-1 break-words">{source.error}</p>}</div></div>)}</div>}
    </form>
    <div className="grid sm:grid-cols-3 gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white/60 p-5"><p className="text-xs text-slate-600">Selected tours indexed</p><p className="text-3xl font-semibold text-slate-900 mt-2">{status?.tours.length ?? "—"}</p><p className="text-xs text-slate-500 mt-2">Of {status?.sources.length || 0} selected links · Refresh every {status?.syncHours || 6} hours</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white/60 p-5"><p className="text-xs text-slate-600">AI connection</p><p className={`font-semibold mt-3 ${status?.aiConfigured ? "text-emerald-700" : "text-brand-700"}`}>{status?.aiConfigured ? "Configured" : "API key needed"}</p><p className="text-xs text-slate-500 mt-2">{status?.aiConfigured ? status.model : "Add your API key in Bot Config."}</p><a href="/admin/bot" className="text-xs text-brand-700 inline-block mt-2">Open AI chatbot settings ↗</a></div>
      <div className="rounded-2xl border border-slate-200 bg-white/60 p-5"><p className="text-xs text-slate-600">Last catalogue sync</p><p className="text-sm font-medium text-slate-900 mt-3">{status?.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleString() : "Awaiting first sync"}</p><p className="text-xs text-slate-500 mt-2">Live details are checked before answering.</p></div>
    </div>
    <div className="p-5 rounded-2xl border border-slate-200 bg-white/60 space-y-3">
      <a href={status?.website || "https://tripanza.com"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-brand-700 font-medium text-sm break-all">{status?.website || "https://tripanza.com"}<ArrowUpRight className="w-4 h-4 shrink-0" /></a>
      <div className="flex flex-wrap gap-2">{["Selected tours", "Their itineraries", "Their accommodation"].map(label => <span key={label} className="rounded-full px-3 py-1 text-xs text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{label}</span>)}</div>
      <p className="text-sm text-slate-600">The assistant selects verified facts from these sections and sends the official itinerary PDF, stay photos, tour photos, or videos when requested. Questions without website evidence go to the team.</p>
      <p className="text-xs text-slate-500">Customer context carries across sessions: the selected trip and recent customer preferences are saved. Customers can send <span className="text-slate-700">/forget</span> to clear their saved context.</p>
      {status && !status.enabled && <p className="text-sm text-brand-700">Website knowledge is disabled. Enable WEBSITE_KNOWLEDGE_ENABLED on the server to use it.</p>}
    </div>
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <div className="rounded-2xl border border-slate-200 bg-white/60 overflow-hidden">
        <div className="p-4 border-b border-slate-200"><div className="flex items-center gap-2 text-slate-600 bg-slate-50 rounded-xl px-3"><Search className="w-4 h-4 shrink-0" /><input aria-label="Search indexed tours" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a trip…" className="w-full bg-transparent py-3 text-sm text-slate-900 outline-none" /></div></div>
        <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-200">{tours.map(tour => <button key={tour.slug} disabled={!!loadingTour} onClick={() => inspect(tour.slug)} className="w-full text-left px-4 py-4 flex items-start justify-between gap-3 hover:bg-slate-100/40 disabled:opacity-60"><span><span className="text-sm font-medium text-slate-800 block">{tour.title}</span><span className="text-xs text-slate-500 mt-1 block break-all">{tour.slug}</span></span><BookOpen className="w-4 h-4 text-brand-700 shrink-0 mt-1" /></button>)}{!tours.length && <p className="p-8 text-sm text-slate-500 text-center">{status ? "No matching tours indexed." : "Loading website knowledge…"}</p>}</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white/60 p-5 space-y-4 min-w-0">
        {loadingTour ? <p className="text-sm text-slate-600">Checking the live tour page…</p> : preview ? <>
          <h2 className="text-lg font-semibold text-slate-900">{preview.title}</h2>
          <div className="flex flex-wrap gap-3 text-xs text-slate-600"><span className="flex items-center gap-1"><FileText className="w-4 h-4" />Official PDF</span><span className="flex items-center gap-1"><Image className="w-4 h-4" />{preview.accommodation.length} stay photos</span><span className="flex items-center gap-1"><Video className="w-4 h-4" />{preview.videos.length} videos</span></div>
          <div className="grid grid-cols-2 gap-3">{preview.accommodation.map((photo, i) => <div key={`${photo.url}-${i}`} className="min-w-0"><img src={photo.url} alt={photo.caption.split("\n")[0]} className="w-full h-32 object-cover rounded-xl" loading="lazy" /><p className="text-xs text-slate-600 mt-2 truncate">{photo.caption.split("\n")[0]}</p></div>)}</div>
          <div className="max-h-80 overflow-y-auto space-y-4 text-sm text-slate-700">{preview.facts.map(f => <p key={f.id} className="whitespace-pre-line border-t border-slate-200 pt-3">{f.text}</p>)}</div>
          <div className="flex flex-wrap gap-4 text-sm"><a href={preview.url} target="_blank" rel="noreferrer" className="text-brand-700">Open tour ↗</a><a href={preview.pdf.url} target="_blank" rel="noreferrer" className="text-brand-700">Open itinerary PDF ↗</a></div>
        </> : <div className="text-center py-12"><BookOpen className="w-9 h-9 text-slate-500 mx-auto mb-3" /><p className="text-sm text-slate-600">Select a trip to preview its facts and accommodation photos.</p><p className="text-xs text-slate-500 mt-2">Previewing a trip does not send any WhatsApp messages.</p></div>}
      </div>
    </div>
  </div>;
}
