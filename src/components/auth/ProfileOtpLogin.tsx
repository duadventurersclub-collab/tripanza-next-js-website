"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

export type AuthenticatedUser = { id?: number; email?: string; display_name?: string };
type AuthChannel = "email" | "whatsapp";
type Props = { mode: "login" | "register"; onBack: () => void; onSuccess: (user?: AuthenticatedUser) => Promise<void> | void };

const ArrowIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg>;
const MailIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2V6c0-1.1-.9-2-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z" /></svg>;
const GoogleIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z" /><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.38l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.6A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.32.32-1.92v-2.6H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.52l3.35-2.6Z" /><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.48l3.35 2.6C7.18 7.71 9.39 5.95 12 5.95Z" /></svg>;
const LinkedInIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0A66C2" d="M20.45 3H3.55A.55.55 0 0 0 3 3.55v16.9c0 .3.25.55.55.55h16.9c.3 0 .55-.25.55-.55V3.55a.55.55 0 0 0-.55-.55ZM8.34 18.34H5.66V9.72h2.68v8.62ZM7 8.54a1.55 1.55 0 1 1 0-3.1 1.55 1.55 0 0 1 0 3.1Zm11.34 9.8h-2.68v-4.2c0-1-.02-2.29-1.4-2.29-1.4 0-1.61 1.09-1.61 2.22v4.27H9.97V9.72h2.57v1.18h.04c.36-.68 1.23-1.4 2.53-1.4 2.71 0 3.21 1.78 3.21 4.1v4.74Z" /></svg>;
const WhatsAppIcon = () => <svg viewBox="0 0 448 512" aria-hidden="true"><path fill="#25D366" d="M380.9 97.1C339 55.1 283.2 32 223.9 32 101.5 32 2 131.5 2 253.9c0 39.1 10.2 77.3 29.6 111L.1 480l117.7-30.9c32.4 17.7 68.9 27 106 27h.1c122.3 0 224.1-99.5 224.1-221.9 0-59.3-25.2-115-67.1-157.1ZM223.9 438.7c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68-4.4-7c-18.5-29.4-28.2-63.4-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.5-186.6 184.5Zm101.2-138.1c-5.5-2.8-32.8-16.1-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6Z" /></svg>;

function masked(value: string, channel: AuthChannel) {
  if (channel === "whatsapp") {
    const digits = value.replace(/\D/g, "");
    return `${digits.length > 10 ? `+${digits.slice(0, -10)} ` : ""}•••• ${digits.slice(-4)}`;
  }
  const [name, domain] = value.split("@");
  return name && domain ? `${name.slice(0, 1)}•••@${domain}` : value;
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({})) as { error?: string; message?: string; user?: AuthenticatedUser };
  if (!response.ok) throw new Error(data.error || data.message || "Something went wrong. Please try again.");
  return data;
}

export default function ProfileOtpLogin({ mode, onBack, onSuccess }: Props) {
  const [channel, setChannel] = useState<AuthChannel>("email");
  const [step, setStep] = useState<"identity" | "otp" | "success">("identity");
  const [identity, setIdentity] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("social_error") || "";
  });
  const [notice, setNotice] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const identityRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => identityRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  const contact = () => channel === "email" ? identity.trim().toLowerCase() : identity.trim();
  const isValid = (value: string) => channel === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : /^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g, "").length >= 10 && value.replace(/\D/g, "").length <= 15;

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    const value = contact();
    if (!isValid(value)) {
      setError(channel === "whatsapp" ? "Enter a valid WhatsApp number with country code." : "Enter a valid email address.");
      identityRef.current?.focus();
      return;
    }
    setLoading(true); setError(""); setNotice("");
    try {
      await parseResponse(await fetch("/api/auth/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: value, channel }) }));
      setIdentity(value); setOtp(""); setStep("otp"); setResendIn(30);
      window.setTimeout(() => otpRef.current?.focus(), 120);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send the code. Please try again."); }
    finally { setLoading(false); }
  }

  async function verifyCode(event?: FormEvent) {
    event?.preventDefault();
    if (!/^\d{4}$/.test(otp)) { setError("Enter the complete 4-digit OTP."); otpRef.current?.focus(); return; }
    setLoading(true); setError(""); setNotice("");
    try {
      const data = await parseResponse(await fetch("/api/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: identity, channel, otp }) }));
      setStep("success");
      await onSuccess(data.user);
    } catch (caught) { setStep("otp"); setError(caught instanceof Error ? caught.message : "Verification failed. Please try again."); otpRef.current?.focus(); }
    finally { setLoading(false); }
  }

  async function resendCode() {
    if (resendIn > 0 || loading) return;
    setLoading(true); setError(""); setNotice("");
    try {
      await parseResponse(await fetch("/api/auth/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: identity, channel }) }));
      setNotice("OTP resent!"); setResendIn(30);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not resend the code."); }
    finally { setLoading(false); }
  }

  function reset(nextChannel = channel) {
    if (nextChannel !== channel) setIdentity("");
    setChannel(nextChannel); setOtp(""); setError(""); setNotice(""); setStep("identity"); setResendIn(0);
    window.setTimeout(() => identityRef.current?.focus(), 80);
  }

  const returnTo = typeof window === "undefined" ? "/" : (() => {
    const params = new URLSearchParams(window.location.search);
    ["profile", "auth", "mode", "social_error"].forEach((key) => params.delete(key));
    const query = params.toString();
    return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  })();
  const socialUrl = (provider: string) => `/api/auth/social/start?provider=${provider}&returnTo=${encodeURIComponent(returnTo)}`;
  const title = step === "otp" ? (channel === "whatsapp" ? <>Verify your <em>number.</em></> : <>Verify your <em>email.</em></>) : step === "success" ? <>You&apos;re <em>in.</em></> : <>Your group trip is <em>waiting.</em></>;

  return <div className={`tp-auth-view is-${channel}${step === "otp" ? " is-otp" : ""}`}>
    <header className="tp-auth-topbar"><button type="button" onClick={step === "identity" ? onBack : () => reset()} aria-label={step === "identity" ? "Back to profile" : "Change contact"}><ArrowIcon /></button></header>
    <form className="tp-auth-card" onSubmit={step === "otp" ? verifyCode : sendCode} noValidate>
      <div className="tp-auth-kicker"><span>Back to group trips</span><b>{channel === "whatsapp" ? "WhatsApp OTP" : "Email OTP"}</b></div>
      <h2>{title}</h2>
      {step === "success" ? <div className="tp-auth-success" role="status"><span>✓</span><strong>{mode === "register" ? "Your account is ready" : "Welcome back"}</strong><p>Your next trip is waiting.</p></div> : step === "identity" ? <>
        <label className="tp-visually-hidden" htmlFor="tp-auth-identity">{channel === "whatsapp" ? "WhatsApp number" : "Email address"}</label>
        <div className="tp-auth-input-wrap">{channel === "whatsapp" ? <WhatsAppIcon /> : <MailIcon />}<input ref={identityRef} id="tp-auth-identity" type={channel === "whatsapp" ? "tel" : "email"} inputMode={channel === "whatsapp" ? "tel" : "email"} autoComplete={channel === "whatsapp" ? "tel" : "email"} value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder={channel === "whatsapp" ? "WhatsApp number with country code" : "Email address"} disabled={loading} /></div>
        {channel === "whatsapp" ? <button className="tp-auth-channel-switch" type="button" onClick={() => reset("email")}>Use email OTP instead</button> : null}
        {error ? <p className="tp-auth-message is-error" role="alert">{error}</p> : null}
        <button className="tp-auth-submit" type="submit" disabled={loading}>{loading ? <><i /> Sending your code</> : channel === "whatsapp" ? "Send WhatsApp OTP" : "Send Email OTP"}</button>
        {channel === "email" ? <><div className="tp-auth-divider"><span>or continue with</span></div><div className="tp-auth-socials" aria-label="Other sign-in options"><a href={socialUrl("google")} aria-label="Continue with Google" title="Continue with Google"><GoogleIcon /></a><a href={socialUrl("linkedin")} aria-label="Continue with LinkedIn" title="Continue with LinkedIn"><LinkedInIcon /></a><button type="button" onClick={() => reset("whatsapp")} aria-label="Continue with WhatsApp OTP" title="Continue with WhatsApp OTP"><WhatsAppIcon /></button></div></> : null}
      </> : <>
        <p className="tp-auth-intro">Enter the 4-digit code sent to <strong>{masked(identity, channel)}</strong></p>
        <div className="tp-auth-otp-wrap"><input ref={otpRef} id="tp-auth-otp" className="tp-auth-otp-input" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={4} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))} disabled={loading} aria-label="Four digit OTP" />{[0, 1, 2, 3].map((index) => <span key={index} className={`${otp[index] ? "is-filled" : ""}${index === Math.min(otp.length, 3) ? " is-current" : ""}`}>{otp[index] || ""}</span>)}</div>
        {error ? <p className="tp-auth-message is-error" role="alert">{error}</p> : null}{notice ? <p className="tp-auth-message is-success" role="status">{notice}</p> : null}
        <div className="tp-auth-otp-extra">Didn&apos;t get OTP? <button type="button" onClick={resendCode} disabled={loading || resendIn > 0}>{resendIn > 0 ? <>Resend in <b>{resendIn}s</b></> : "Resend OTP"}</button></div>
        <button className="tp-auth-change" type="button" onClick={() => reset()}>Change {channel === "whatsapp" ? "phone number" : "email address"}</button>
        <button className="tp-auth-submit tp-auth-verify" type="submit" disabled={loading || otp.length !== 4}>{loading ? <><i /> Checking your code</> : "Verify & Login"}</button>
      </>}
    </form>
    <p className="tp-auth-legal">By continuing, you agree to Tripanza&apos;s <a href="https://tripanza.com/tnc/">terms</a> and <a href="https://tripanza.com/privacy-policy/">privacy policy</a>.</p>
  </div>;
}
