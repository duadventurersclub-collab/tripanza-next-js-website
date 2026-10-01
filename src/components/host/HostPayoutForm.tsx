"use client";

import Link from "next/link";
import { useState } from "react";
import type { HostPayout } from "@/lib/host";

export default function HostPayoutForm({ initial }: { initial: HostPayout }) {
  const [payout, setPayout] = useState(initial);
  const [method, setMethod] = useState<"bank" | "upi">(initial.method);
  const [holder, setHolder] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upi, setUpi] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/host/payout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, account_holder: holder, bank_name: bank, account_number: account, ifsc, upi_id: upi }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Could not save payout details.");
      setPayout(data.payout);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <div style={{ maxWidth: 760, margin: "auto" }}><span className="host-eyebrow">HOST MONEY MODE</span><h1 className="host-title">Your trips.<br />Your earnings.<br /><em>Your payout.</em></h1><p className="host-copy">Add one verified payout destination. Once saved, the details lock to protect your host earnings.</p><div className="host-panel" style={{ marginTop: 25 }}><span className="host-eyebrow">TRIPANZA PAYOUT PASS</span><h2>{payout.locked ? "Your details are locked." : "Set up your payout."}</h2>{payout.locked ? <><p className="host-copy">Sensitive details stay masked. Contact host support if your bank account or UPI ID changes.</p><div className="host-grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))", marginTop: 20 }}><div><small>METHOD</small><p><strong>{payout.method === "bank" ? "Bank account" : "UPI"}</strong></p></div>{payout.method === "bank" ? <><div><small>ACCOUNT HOLDER</small><p><strong>{payout.account_holder}</strong></p></div><div><small>ACCOUNT NUMBER</small><p><strong>{payout.account_masked}</strong></p></div><div><small>IFSC</small><p><strong>{payout.ifsc_masked}</strong></p></div></> : <div><small>UPI ID</small><p><strong>{payout.upi_masked}</strong></p></div>}</div><Link href="/contact" className="host-text-link">Need a change? Contact host support →</Link></> : <form className="host-form" onSubmit={submit}><div style={{ display: "flex", gap: 10 }}><label style={{ flex: 1, padding: 15, border: "1px solid #dce3ee", borderRadius: 12 }}><input type="radio" name="method" style={{ width: 18, minHeight: 18 }} checked={method === "bank"} onChange={() => setMethod("bank")} /> Bank account</label><label style={{ flex: 1, padding: 15, border: "1px solid #dce3ee", borderRadius: 12 }}><input type="radio" name="method" style={{ width: 18, minHeight: 18 }} checked={method === "upi"} onChange={() => setMethod("upi")} /> UPI ID</label></div>{method === "bank" ? <><label>Account holder name<input required minLength={2} value={holder} onChange={event => setHolder(event.target.value)} placeholder="Name as per bank" /></label><label>Bank name<input required minLength={2} value={bank} onChange={event => setBank(event.target.value)} placeholder="e.g. ICICI Bank" /></label><label>Account number<input required inputMode="numeric" pattern="[0-9]{6,20}" value={account} onChange={event => setAccount(event.target.value)} /></label><label>IFSC code<input required pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" maxLength={11} value={ifsc} onChange={event => setIfsc(event.target.value.toUpperCase())} /></label></> : <label>UPI ID<input required value={upi} onChange={event => setUpi(event.target.value)} placeholder="yourname@bank" /></label>}<p className="host-copy">Check twice before locking. Tripanza will never ask for an OTP, PIN or password to release a payout.</p>{error && <p className="host-error" role="alert">{error}</p>}<button className="host-button" type="submit" disabled={busy}>{busy ? "Securing details…" : "Save and lock payout details"}<span>→</span></button></form>}</div></div>;
}
