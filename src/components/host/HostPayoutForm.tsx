"use client";

import Link from "next/link";
import { useState } from "react";
import type { HostPayout } from "@/lib/host";
import "./payout-original.css";

export default function HostPayoutForm({ initial }: { initial: HostPayout }) {
  const [payout, setPayout] = useState(initial);
  const [method, setMethod] = useState<"bank" | "upi">(initial.method);
  const [holder, setHolder] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upi, setUpi] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/host/payout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, account_holder: holder, bank_name: bank, account_number: account, ifsc, upi_id: upi }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Could not save payout details.");
      setPayout(data.payout); setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <div className="tp-payout-page"><main className="tp-shell">
    <header className="tp-top"><Link className="tp-logo" href="/"><i>T</i>Tripanza</Link></header>
    <section className="tp-hero"><span className="tp-eyebrow">HOST MONEY MODE</span><h1>Your trips.<br />Your earnings.<br /><em>Your payout.</em></h1><p>Add one verified payout destination. Once saved, the details lock to protect your host earnings.</p></section>
    {saved && <div className="tp-alert" role="status"><b>✓</b><div><strong>Payout destination secured.</strong>Your eligible host earnings will use these details.</div></div>}
    {error && <div className="tp-alert error" role="alert"><b>!</b><div><strong>That didn’t save.</strong>{error}</div></div>}
    <section className="tp-pass"><header className="tp-pass-head"><span>TRIPANZA PAYOUT PASS</span><strong>{payout.locked ? "SECURED" : "SETUP REQUIRED"}</strong></header><div className="tp-pass-body">
      {payout.locked ? <div className="tp-lock-card"><span>✓ PAYOUT READY</span><h2>Your details are locked.</h2><p>We mask sensitive information after setup. Contact host support if your bank account or UPI ID changes.</p><div className="tp-lock-details"><div><small>PAYOUT METHOD</small><strong>{payout.method === "bank" ? "Bank account" : "UPI"}</strong></div>{payout.method === "bank" ? <><div><small>ACCOUNT HOLDER</small><strong>{payout.account_holder}</strong></div><div><small>ACCOUNT NUMBER</small><strong>{payout.account_masked}</strong></div><div><small>IFSC</small><strong>{payout.ifsc_masked}</strong></div></> : <div><small>UPI ID</small><strong>{payout.upi_masked}</strong></div>}</div><Link className="tp-support" href="/contact">Need a change? Contact host support →</Link></div> :
      <form onSubmit={submit}><div className="tp-methods"><label className="tp-method"><input type="radio" name="payout_method" value="bank" checked={method === "bank"} onChange={() => setMethod("bank")} /><div><i>▣</i><span><b>Bank account</b><small>NEFT / IMPS</small></span></div></label><label className="tp-method"><input type="radio" name="payout_method" value="upi" checked={method === "upi"} onChange={() => setMethod("upi")} /><div><i>₹</i><span><b>UPI ID</b><small>FAST &amp; SIMPLE</small></span></div></label></div>
        <div className="tp-fields" hidden={method !== "bank"}><label className="tp-field"><span>Account holder name <small>AS PER BANK</small></span><input autoComplete="name" required={method === "bank"} minLength={2} value={holder} onChange={event => setHolder(event.target.value)} placeholder="Name on the bank account" /></label><label className="tp-field"><span>Bank name</span><input required={method === "bank"} minLength={2} value={bank} onChange={event => setBank(event.target.value)} placeholder="e.g. ICICI Bank" /></label><div className="tp-grid"><label className="tp-field"><span>Account number</span><input required={method === "bank"} inputMode="numeric" autoComplete="off" pattern="[0-9]{6,20}" maxLength={20} value={account} onChange={event => setAccount(event.target.value)} placeholder="0000000000" /></label><label className="tp-field"><span>IFSC code</span><input required={method === "bank"} autoComplete="off" pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" maxLength={11} value={ifsc} onChange={event => setIfsc(event.target.value.toUpperCase())} placeholder="ABCD0123456" /></label></div></div>
        <div className="tp-fields" hidden={method !== "upi"}><label className="tp-field"><span>UPI ID <small>VPA</small></span><input required={method === "upi"} autoComplete="off" pattern="[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}" value={upi} onChange={event => setUpi(event.target.value)} placeholder="yourname@bank" /></label></div>
        <div className="tp-security"><i>⌾</i><div><strong>Check twice before locking.</strong>Your payout details are stored in your WordPress account and used for eligible Tripanza host payouts.</div></div><button className="tp-submit" type="submit" disabled={busy}>{busy ? "Securing details…" : "Save and lock payout details"} <i>→</i></button>
      </form>}
    </div></section>
  </main></div>;
}
