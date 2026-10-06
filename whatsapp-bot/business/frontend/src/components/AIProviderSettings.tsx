"use client";

import { useEffect, useState } from "react";
import { KeyRound, Save, CheckCircle2, AlertCircle, Loader2, Plug } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface ProviderStatus {
  configured: boolean; source: "workspace" | "environment" | "none";
  environmentConfigured: boolean; model: string; provider: string;
}
export default function AIProviderSettings() {
  const { user } = useAuth();
  const canEdit = user?.role === "super_admin";
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ success: boolean; text: string } | null>(null);
  useEffect(() => {
    apiFetch("/api/admin/ai-provider").then(async response => {
      if (!response.ok) throw new Error("Could not load AI connection settings.");
      setStatus(await response.json());
    }).catch(e => setNotice({ success: false, text: e.message }));
  }, []);
  async function act(action: "save" | "test" | "remove") {
    setBusy(action); setNotice(null);
    try {
      const response = await apiFetch(`/api/admin/ai-provider${action === "test" ? "/test" : ""}`, {
        method: action === "test" ? "POST" : action === "save" ? "PUT" : "DELETE",
        ...(action === "save" ? { body: JSON.stringify({ apiKey: key.trim() }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the AI connection.");
      if (action !== "test") { setStatus(data); setKey(""); }
      setNotice({ success: true, text: action === "test" ? data.message : action === "save" ? "API key saved. New AI replies will use it immediately." : data.configured ? "Saved key removed. The Render environment key is now active." : "Saved key removed. Add a key to enable AI replies." });
    } catch (e) { setNotice({ success: false, text: e instanceof Error ? e.message : "Could not update the AI connection." }); }
    finally { setBusy(""); }
  }
  return <div className="rounded-xl border border-slate-200 bg-white p-5 mb-5 space-y-4">
    <div className="flex flex-wrap justify-between items-center gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><KeyRound size={16} className="text-brand-700" />AI connection</h3>
      <span className={`text-xs rounded-full px-2.5 py-1 ${status?.configured ? "text-emerald-700 bg-emerald-500/10" : "text-brand-700 bg-brand-600/10"}`}>{status ? status.configured ? "Key configured" : "API key needed" : "Loading…"}</span>
    </div>
    {status && <p className="text-xs text-slate-600 break-words">{status.provider} · {status.model}{status.configured ? ` · ${status.source === "workspace" ? "Saved in workspace" : "Set on Render"}` : ""}</p>}
    {canEdit ? <>
      <div>
        <label htmlFor="ai-provider-key" className="block text-xs font-medium text-slate-600 mb-1.5">AI API key</label>
        <input id="ai-provider-key" type="password" value={key} onChange={e => { setKey(e.target.value); setNotice(null); }} autoComplete="off" spellCheck={false} disabled={!!busy || !status} aria-describedby="ai-key-help" placeholder={status?.configured ? "Paste a new key to replace the current key" : "Paste your AI provider API key"} className="w-full min-w-0 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20 disabled:opacity-50" />
        <p id="ai-key-help" className="text-xs text-slate-500 mt-2">Stored encrypted on the server. The saved key is never displayed. Leave this blank to keep your current key.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => act("save")} disabled={!!busy || !status || !key.trim()} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save API key</button>
        <button onClick={() => act("test")} disabled={!!busy || !status?.configured || !!key.trim()} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50">{busy === "test" ? <Loader2 size={15} className="animate-spin" /> : <Plug size={15} />}Test connection</button>
        {status?.source === "workspace" && <button onClick={() => act("remove")} disabled={!!busy} className="text-xs text-slate-600 hover:text-brand-700 disabled:opacity-50">{status.environmentConfigured ? "Use Render key" : "Remove saved key"}</button>}
      </div>
      <p className="text-xs text-slate-500">Save before testing. The test makes one small request to your AI provider.</p>
    </> : <p className="text-xs text-slate-600">The workspace owner can add or replace the API key here.</p>}
    {notice && <div role="status" className={`flex items-start gap-2 text-sm rounded-lg p-3 ${notice.success ? "text-emerald-700 bg-emerald-500/10" : "text-red-300 bg-red-500/10"}`}>{notice.success ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}<p>{notice.text}</p></div>}
  </div>;
}
