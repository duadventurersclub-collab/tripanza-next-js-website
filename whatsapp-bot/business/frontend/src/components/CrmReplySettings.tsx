"use client";

import { useEffect, useState } from "react";
import { Clock, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Toggle } from "@/components/ui";

interface Controls { enabled: boolean; scheduleEnabled: boolean; timezone: string; days: number[]; start: string; end: string }
interface State { settings: Controls; revision: string; allowed: boolean; reason: string }
const weekdays = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]] as const;
const field = "w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-600/50";
export default function CrmReplySettings() {
  const [saved, setSaved] = useState<State | null>(null), [form, setForm] = useState<Controls | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    async function load(initial = false) {
      try {
        const response = await apiFetch("/api/admin/crm-replies");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load CRM reply settings.");
        if (active) { setSaved(data); if (initial) setForm(data.settings); }
      } catch (e) { if (active && initial) { setError(true); setNotice(e instanceof Error ? e.message : "Could not load settings."); } }
    }
    void load(true);
    const timer = setInterval(() => void load(), 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  async function save() {
    setBusy(true); setNotice("");
    try {
      const response = await apiFetch("/api/admin/crm-replies", { method: "PUT", body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save CRM reply settings.");
      setSaved(data); setForm(data.settings); setError(false); setNotice("CRM reply settings saved.");
    } catch (e) { setError(true); setNotice(e instanceof Error ? e.message : "Could not save settings."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-slate-200 bg-white p-5 mb-5 space-y-4" aria-label="CRM AI reply controls">
    <div className="flex flex-wrap justify-between items-center gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Clock size={16} className="text-brand-700" />CRM AI replies</h3>
      <span className={`text-xs rounded-full px-2.5 py-1 ${saved?.allowed ? "text-emerald-700 bg-emerald-500/10" : "text-slate-600 bg-slate-100"}`}>{saved ? saved.allowed ? "AI replies available now" : saved.reason === "disabled" ? "Human only" : "Outside AI hours" : "Loading..."}</span>
    </div>
    <p className="text-xs text-slate-600">Turn AI off to let your team handle CRM conversations. Human messages, OTPs, booking notifications and requested PDFs stay available.</p>
    {form && <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
      <div className="flex justify-between items-center gap-3"><label htmlFor="crm-ai-enabled" className="text-sm text-slate-800">Enable AI auto replies</label><Toggle id="crm-ai-enabled" label="Enable CRM AI auto replies" checked={form.enabled} onChange={enabled => setForm({ ...form, enabled })} disabled={busy} /></div>
      <div className="flex justify-between items-center gap-3"><label htmlFor="crm-ai-schedule" className="text-sm text-slate-800">Schedule AI replies</label><Toggle id="crm-ai-schedule" label="Schedule CRM AI replies" checked={form.scheduleEnabled} onChange={scheduleEnabled => setForm({ ...form, scheduleEnabled })} disabled={busy} /></div>
      {form.scheduleEnabled && <div className="space-y-4 rounded-lg bg-slate-50 border border-slate-200 p-4">
        <div><label htmlFor="crm-ai-timezone" className="block text-xs font-medium text-slate-600 mb-1.5">Timezone</label><input id="crm-ai-timezone" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} list="crm-ai-timezones" className={field} /><datalist id="crm-ai-timezones"><option value="Asia/Calcutta" /><option value="Asia/Kolkata" /><option value="UTC" /><option value="Europe/London" /><option value="America/New_York" /></datalist></div>
        <div><p className="text-xs font-medium text-slate-600 mb-2">Days when AI hours start</p><div className="flex flex-wrap gap-2">{weekdays.map(([day, name]) => <label key={day} className="inline-flex items-center gap-2 border border-slate-200 rounded-lg bg-white px-2.5 py-2 text-xs text-slate-700"><input type="checkbox" checked={form.days.includes(day)} onChange={e => setForm({ ...form, days: e.target.checked ? [...form.days, day] : form.days.filter(value => value !== day) })} />{name}</label>)}</div></div>
        <div className="grid grid-cols-2 gap-3"><div><label htmlFor="crm-ai-start" className="block text-xs font-medium text-slate-600 mb-1.5">Start time</label><input id="crm-ai-start" type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} className={field} /></div><div><label htmlFor="crm-ai-end" className="block text-xs font-medium text-slate-600 mb-1.5">End time</label><input id="crm-ai-end" type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} className={field} /></div></div>
        <p className="text-xs text-slate-500">Times use the selected timezone. If the end is earlier than the start, the window continues into the next day. Outside these hours, new enquiries wait for your team.</p>
      </div>}
      <p className="text-xs text-slate-500">{!form.enabled ? "AI stays off until you enable it, even during scheduled hours." : !form.scheduleEnabled ? "AI replies are allowed at any time for chats assigned to the bot." : "AI replies are allowed only on the selected days and hours."} Chats already claimed or passed to your team stay with the team until resumed.</p>
      <button type="button" onClick={() => void save()} disabled={busy} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"><Save size={15} />{busy ? "Saving..." : "Save reply settings"}</button>
    </fieldset>}
    {notice && <p role="status" className={`text-xs ${error ? "text-red-700" : "text-emerald-700"}`}>{notice}</p>}
  </section>;
}
