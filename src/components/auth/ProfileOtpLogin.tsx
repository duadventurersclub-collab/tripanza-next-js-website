"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

export type AuthenticatedUser = {
  id?: number;
  email?: string;
  display_name?: string;
};

type ProfileOtpLoginProps = {
  mode: "login" | "register";
  onBack: () => void;
  onSuccess: (user?: AuthenticatedUser) => Promise<void> | void;
};

function ArrowLeftIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg>;
}

function MailIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>;
}

function PlaneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5Z" /></svg>;
}

function maskedEmail(value: string) {
  const [name, domain] = value.split("@");
  if (!name || !domain) return value;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"•".repeat(Math.max(2, Math.min(5, name.length - visible.length)))}@${domain}`;
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({})) as { error?: string; message?: string; user?: AuthenticatedUser };
  if (!response.ok) throw new Error(data.error || data.message || "Something went wrong. Please try again.");
  return data;
}

export default function ProfileOtpLogin({ mode, onBack, onSuccess }: ProfileOtpLoginProps) {
  const [step, setStep] = useState<"identity" | "otp" | "success">("identity");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => emailRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      await parseResponse(response);
      setEmail(normalizedEmail);
      setOtp("");
      setStep("otp");
      setResendIn(30);
      window.setTimeout(() => otpRef.current?.focus(), 120);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(otp)) {
      setError("Enter the complete 4-digit OTP.");
      otpRef.current?.focus();
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await parseResponse(response);
      setStep("success");
      await onSuccess(data.user);
    } catch (caught) {
      setStep("otp");
      setError(caught instanceof Error ? caught.message : "Verification failed. Please try again.");
      otpRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (resendIn > 0 || loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await parseResponse(response);
      setNotice("A fresh OTP has been sent.");
      setResendIn(30);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resend the code.");
    } finally {
      setLoading(false);
    }
  }

  function changeEmail() {
    setStep("identity");
    setOtp("");
    setError("");
    setNotice("");
    setResendIn(0);
    window.setTimeout(() => emailRef.current?.focus(), 80);
  }

  return (
    <div className="tp-auth-view">
      <header className="tp-auth-topbar">
        <button type="button" onClick={onBack} aria-label="Back to profile"><ArrowLeftIcon /></button>
        <span>{mode === "register" ? "Create account" : "Login"}</span>
        <span aria-hidden="true" />
      </header>

      <div className="tp-auth-card">
        <div className="tp-auth-kicker"><span>Back to group trips</span><b>Email OTP</b></div>
        <h2>{step === "success" ? <>You&apos;re <em>in.</em></> : <>Your group trip is <em>waiting.</em></>}</h2>
        <div className="tp-auth-route" aria-hidden="true"><span /><PlaneIcon /></div>

        {step === "success" ? (
          <div className="tp-auth-success" role="status">
            <span>✓</span>
            <strong>{mode === "register" ? "Your account is ready" : "Welcome back"}</strong>
            <p>Loading your bookings, wallet and saved trips…</p>
          </div>
        ) : step === "identity" ? (
          <form onSubmit={sendCode} noValidate>
            <p className="tp-auth-intro">{mode === "register" ? "Start with your email. We’ll create your Tripanza account after verification." : "No password needed. We’ll send a secure 4-digit login code to your email."}</p>
            <label className="tp-auth-label" htmlFor="tp-auth-email">Email address</label>
            <div className="tp-auth-input-wrap">
              <MailIcon />
              <input ref={emailRef} id="tp-auth-email" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={loading} />
            </div>
            {error ? <p className="tp-auth-message is-error" role="alert">{error}</p> : null}
            <button className="tp-auth-submit" type="submit" disabled={loading}>{loading ? <><i /> Sending code…</> : "Send Email OTP"}</button>
            <p className="tp-auth-footnote">New traveller? The same OTP securely creates your account—no separate password or form.</p>
          </form>
        ) : (
          <form onSubmit={verifyCode} noValidate>
            <p className="tp-auth-intro">Enter the 4-digit code sent to <strong>{maskedEmail(email)}</strong>.</p>
            <button className="tp-auth-change" type="button" onClick={changeEmail}>Change email</button>
            <label className="tp-auth-label" htmlFor="tp-auth-otp">Four digit OTP</label>
            <input ref={otpRef} id="tp-auth-otp" className="tp-auth-otp" name="otp" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={4} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="• • • •" disabled={loading} />
            {error ? <p className="tp-auth-message is-error" role="alert">{error}</p> : null}
            {notice ? <p className="tp-auth-message is-success" role="status">{notice}</p> : null}
            <button className="tp-auth-submit" type="submit" disabled={loading || otp.length !== 4}>{loading ? <><i /> Verifying…</> : mode === "register" ? "Verify & Create Account" : "Verify & Login"}</button>
            <button className="tp-auth-resend" type="button" onClick={resendCode} disabled={loading || resendIn > 0}>{resendIn > 0 ? <>Resend in <b>{resendIn}s</b></> : "Resend OTP"}</button>
          </form>
        )}
      </div>
      <p className="tp-auth-legal">By continuing, you agree to Tripanza&apos;s <a href="https://tripanza.com/tnc/">terms</a> and <a href="https://tripanza.com/privacy-policy/">privacy policy</a>.</p>
    </div>
  );
}
