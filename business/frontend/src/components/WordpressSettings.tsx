"use client";
import { useEffect, useState } from "react";
import { Plug, Download, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface Status { configured: boolean; connected: boolean; website: string; emailEnabled: boolean; bookingEnabled: boolean; emailReady: boolean; bookingReady: boolean }
export default function WordpressSettings() {
  const { user } = useAuth(), canEdit = user?.role === "super_admin";
  const [status, setStatus] = useState<Status | null>(null), [token, setToken] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true), [bookingEnabled, setBookingEnabled] = useState(true);
  const [busy, setBusy] = useState(""), [notice, setNotice] = useState<{ success: boolean; text: string } | null>(null);
  function apply(data: Status) { setStatus(data); if (data.configured) { setEmailEnabled(data.emailEnabled); setBookingEnabled(data.bookingEnabled); } }
  useEffect(() => { apiFetch("/api/admin/wordpress").then(async r => { if (!r.ok) throw new Error(); apply(await r.json()); }).catch(() => setNotice({ success: false, text: "Could not load WordPress connection settings." })); }, []);
  const dirty = !!token.trim() || !!status?.configured && (status.emailEnabled !== emailEnabled || status.bookingEnabled !== bookingEnabled);
  async function act(action: "save" | "test" | "disconnect" | "download") {
    setBusy(action); setNotice(null);
    try {
      const url = "/api/admin/wordpress" + (action === "test" ? "/test" : action === "download" ? "/plugin" : "");
      const response = await apiFetch(url, { method: action === "save" ? "PUT" : action === "disconnect" ? "DELETE" : action === "test" ? "POST" : "GET", ...(action === "save" ? { body: JSON.stringify({ ...(token.trim() ? { token: token.trim() } : {}), emailEnabled, bookingEnabled }) } : {}) });
      if (action === "download" && response.ok) {
        const objectUrl = URL.createObjectURL(await response.blob()), anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = "tripanza-workspace-bridge.zip"; anchor.click(); URL.revokeObjectURL(objectUrl);
        setNotice({ success: true, text: "Plugin downloaded. Upload it in WordPress → Plugins → Add New → Upload Plugin, then activate it." }); return;
      }
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not update the WordPress connection.");
      apply(action === "test" ? result.status : result); setToken("");
      setNotice({ success: true, text: action === "save" ? "Settings saved. Test the connection before using its features." : action === "test" ? result.message : "WordPress disconnected. Its email and booking actions are disabled." });
    } catch (error) { setNotice({ success: false, text: error instanceof Error ? error.message : "Could not update the WordPress connection." }); if (action === "test") setStatus(s => s ? { ...s, connected: false, emailReady: false, bookingReady: false } : null); }
    finally { setBusy(""); }
  }
  const inputClass = "w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-brand-600/50 disabled:opacity-50";
  return <div className="rounded-xl border border-slate-200 bg-white p-5 mb-5 space-y-4">
    <div className="flex flex-wrap justify-between items-center gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Plug size={16} className="text-brand-700" />Website email &amp; bookings</h3><span className={`text-xs rounded-full px-2.5 py-1 ${status?.connected ? "text-emerald-700 bg-emerald-500/10" : "text-brand-700 bg-brand-600/10"}`}>{status?.connected ? "Connected" : status?.configured ? "Connection test needed" : "Setup needed"}</span></div>
    <p className="text-sm text-slate-700">Email official itineraries and create group-trip bookings with your website&apos;s pricing and payment links.</p>
    {status && <p className="text-xs text-slate-600 break-all">{status.website}</p>}
    {canEdit ? <>
      <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-600"><li>Download and activate the bridge plugin on your WordPress site. Keep your existing Tripanza WhatsApp AI CRM plugin active.</li><li>In WordPress, open <strong className="text-slate-700">Settings → Tripanza Workspace</strong> and generate a connection key.</li><li>Paste it below, save and test the connection.</li></ol>
      <button onClick={() => act("download")} disabled={!!busy} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"><Download size={15} />Download WordPress plugin</button>
      <div><label htmlFor="wordpress-key" className="block text-xs font-medium text-slate-600 mb-1.5">WordPress connection key</label><input id="wordpress-key" type="password" autoComplete="off" spellCheck={false} value={token} onChange={e => setToken(e.target.value)} placeholder={status?.configured ? "Leave blank to keep the saved key" : "Paste the key from WordPress settings"} disabled={!!busy || !status} className={inputClass} /><p className="text-xs text-slate-500 mt-2">Saved encrypted. This is separate from your AI API key.</p></div>
      <div className="space-y-2 text-sm text-slate-700"><label className="flex items-center gap-2"><input type="checkbox" checked={emailEnabled} onChange={e => setEmailEnabled(e.target.checked)} disabled={!!busy} />Email itineraries on customer request</label><label className="flex items-center gap-2"><input type="checkbox" checked={bookingEnabled} onChange={e => setBookingEnabled(e.target.checked)} disabled={!!busy} />Create bookings after the customer confirms the summary</label></div>
      <div className="flex flex-wrap gap-3 items-center"><button onClick={() => act("save")} disabled={!!busy || !status || !dirty && !!status.configured || !status?.configured && !token.trim()} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Save connection</button><button onClick={() => act("test")} disabled={!!busy || !status?.configured || dirty} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50">Test connection</button>{status?.configured && <button onClick={() => act("disconnect")} disabled={!!busy} className="text-xs text-slate-600 hover:text-brand-700 disabled:opacity-50">Disconnect</button>}{busy && <Loader2 size={16} className="animate-spin text-brand-700" />}</div>
      <p className="text-xs text-slate-500">Testing checks feature availability without sending email or creating an order. Customers review the total and advance before confirming. Payment and seats are confirmed by your website and team.</p>
    </> : <p className="text-xs text-slate-600">The workspace owner can connect WordPress here.</p>}
    {status?.connected && <div className="text-xs text-slate-600">Itinerary email: {status.emailReady ? "Ready" : "Disabled or missing website function"} · Booking: {status.bookingReady ? "Ready" : "Disabled or missing website function"}</div>}
    {notice && <p role="status" className={`text-sm rounded-lg p-3 ${notice.success ? "text-emerald-700 bg-emerald-500/10" : "text-red-300 bg-red-500/10"}`}>{notice.text}</p>}
  </div>;
}
