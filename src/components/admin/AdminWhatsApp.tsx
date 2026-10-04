"use client";
/* eslint-disable @next/next/no-img-element -- private, short-lived QR PNG must be fetched with the administrator's session cookie */

import { useEffect, useState } from "react";
import "./admin-whatsapp.css";

type BotState = { connected: boolean; qr_available: boolean; state: string };
type Status = { enabled: boolean; bots?: { notifications: BotState; crm: BotState }; message?: string };

const names = { notifications: "Notifications & OTPs", crm: "Kanika AI CRM" } as const;

export default function AdminWhatsApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [qrVersion, setQrVersion] = useState(0);
  const [selected, setSelected] = useState<keyof typeof names | null>(null);
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/whatsapp/status", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
        const data: Status & { error?: string } = await response.json();
        if (!active) return;
        setStatus(data);
        setError(response.ok ? "" : data.message || data.error || "Bot status is unavailable.");
        setQrVersion(Date.now());
      } catch {
        if (active) {
          setStatus(null);
          setError("Bot status could not be read. The integrated service may not be deployed or is temporarily unavailable.");
        }
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);

  return <main className="wa-admin">
    <div className="wa-admin__shell">
      <span className="wa-admin__eyebrow">TRIPANZA / ADMIN / WHATSAPP</span>
      <h1>Your conversations.<br /><em>One place.</em></h1>
      <p className="wa-admin__intro">Monitor both numbers and scan a QR code when a connection needs pairing. The existing WordPress AI/CRM continues to prepare replies and follow-ups.</p>
      {error && <p className="wa-admin__notice" role="status">{error}</p>}
      <div className="wa-admin__grid">
        {(Object.keys(names) as (keyof typeof names)[]).map(kind => {
          const bot = status?.bots?.[kind];
          return <section className="wa-admin__card" key={kind}>
            <span className="wa-admin__icon" aria-hidden="true">{kind === "crm" ? "✦" : "↗"}</span>
            <div><small>{kind === "crm" ? "INBOUND + OUTBOUND" : "OUTBOUND ONLY"}</small><h2>{names[kind]}</h2><p>{kind === "crm" ? "Replies, trip media and human-response logging." : "Booking notices, verification codes and updates."}</p></div>
            <strong className={bot?.connected ? "wa-admin__online" : "wa-admin__offline"}>{status?.enabled === false ? "Not activated here" : !status ? "Status unavailable" : bot?.connected ? "Connected" : bot?.state === "scan_qr" ? "Scan QR to connect" : bot?.state === "reconnecting" ? "Reconnecting" : bot?.state === "logged_out" ? "Logged out" : "Offline"}</strong>
            <button type="button" disabled={!bot?.qr_available} onClick={() => setSelected(kind)}>{status?.enabled === false ? "Pairing unavailable" : bot?.qr_available ? "View pairing QR" : bot?.connected ? "Already paired" : "QR not ready"}</button>
          </section>;
        })}
      </div>
      <p className="wa-admin__footnote">This page cannot activate the new bot. It must be enabled on an always-on server with persistent, private session storage. Leave the old bot running until both numbers and all message flows are tested.</p>
    </div>
    {selected && <div className="wa-admin__backdrop" role="presentation" onClick={() => setSelected(null)}><section className="wa-admin__modal" role="dialog" aria-modal="true" aria-label={`${names[selected]} pairing`} onClick={event => event.stopPropagation()}><button className="wa-admin__close" type="button" onClick={() => setSelected(null)} aria-label="Close QR">×</button><h2>Connect {names[selected]}</h2><p>Open WhatsApp on that phone, choose Linked devices, then scan this code.</p><img src={`/api/whatsapp/qr?bot=${selected}&v=${qrVersion}`} alt={`Pair ${names[selected]} with WhatsApp`} width={320} height={320} /><small>The QR refreshes automatically while this page is open.</small></section></div>}
  </main>;
}
