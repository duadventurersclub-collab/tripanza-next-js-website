"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/admin/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }), cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.challenge !== "string") throw new Error(result.error || "Could not sign in.");
      setChallenge(result.challenge);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally { setBusy(false); }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/admin/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge, code }), cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not verify your code.");
      router.replace("/admin");
    } catch (caught) {
      setCode("");
      setError(caught instanceof Error ? caught.message : "Could not verify your code.");
      setBusy(false);
    }
  }

  return <main className="tripanza-admin-login">
    <div className="tripanza-admin-login__card">
      <Link href="/" className="tripanza-admin-login__brand" aria-label="Tripanza homepage">tripanza<span>.</span></Link>
      <p className="tripanza-admin-login__eyebrow">Secure admin access</p>
      <h1>{challenge ? "Check your email." : "Welcome back."}</h1>
      <p className="tripanza-admin-login__intro">{challenge ? "If this is a registered admin email, an 8-digit code is on its way. It expires in 5 minutes. Check spam if it does not arrive." : "Enter the email on your WordPress administrator account. This sign-in is separate from the customer login."}</p>
      {error && <p className="tripanza-admin-login__error" role="alert">{error}</p>}
      {!challenge ? <form onSubmit={submitEmail}>
        <label htmlFor="admin-email">Admin email</label>
        <input id="admin-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
        <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send sign-in code"}</button>
      </form> : <form onSubmit={submitCode}>
        <label htmlFor="admin-code">Email verification code</label>
        <input id="admin-code" type="text" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} autoComplete="one-time-code" autoFocus required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} />
        <button type="submit" disabled={busy || code.length !== 8}>{busy ? "Verifying…" : "Open admin dashboard"}</button>
        <button type="button" className="tripanza-admin-login__restart" onClick={() => { setChallenge(""); setCode(""); setError(""); }}>Change email or request a new code</button>
      </form>}
      <p className="tripanza-admin-login__foot">Codes work once. Wait 30 seconds before requesting another. Customer OTPs cannot open this dashboard.</p>
    </div>
  </main>;
}
