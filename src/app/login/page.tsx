"use client";

import { useMemo, useState } from "react";

const WORDPRESS_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL || "http://localhost:10005";

export default function LoginPage() {
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const wpApi = useMemo(() => `${WORDPRESS_URL.replace(/\/$/, "")}/wp-json/tripanza-headless/v1`, []);

  async function sendOtp() {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${wpApi}/auth/otp/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          channel: method,
          email: method === "email" ? identifier : "",
          phone: method === "phone" ? identifier : "",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.code || "Unable to send OTP.");
      }

      setOtpSent(true);
      setMessage({ type: "success", text: "OTP sent successfully. Check your inbox or WhatsApp." });
    } catch (error) {
      setOtpSent(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Something went wrong while sending the code.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${wpApi}/auth/otp/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          channel: method,
          email: method === "email" ? identifier : "",
          phone: method === "phone" ? identifier : "",
          otp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.code || "OTP verification failed.");
      }

      setMessage({ type: "success", text: "Login successful. Redirecting to your account..." });
      const target = data?.redirect || "/account";
      window.location.href = target;
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "The code could not be verified.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${wpApi}/auth/google/start?return_url=${encodeURIComponent(window.location.origin + "/account")}`);
      const data = await res.json();
      if (!res.ok || !data?.auth_url) {
        throw new Error(data?.message || "Google login is not configured yet.");
      }
      window.location.href = data.auth_url;
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Google login could not be started.",
      });
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-2">
        <div className="bg-slate-950 p-8 text-white lg:p-12">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-400">Tripanza</p>
          <h1 className="mt-5 text-4xl font-black leading-tight">Welcome back to effortless travel.</h1>
          <p className="mt-4 max-w-md text-sm text-slate-300">
            Sign in to view your wallet, manage trips, and unlock personalized offers without slowing down the experience.
          </p>
        </div>

        <div className="p-8 lg:p-12">
          <div className="mb-6 flex gap-2 rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMethod("email")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${method === "email" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              Email OTP
            </button>
            <button
              type="button"
              onClick={() => setMethod("phone")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${method === "phone" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              WhatsApp OTP
            </button>
          </div>

          <label className="mb-2 block text-sm font-semibold text-slate-700">
            {method === "email" ? "Email address" : "WhatsApp number"}
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={method === "email" ? "you@example.com" : "+91 98765 43210"}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
          />

          <button
            type="button"
            onClick={sendOtp}
            disabled={loading || !identifier.trim()}
            className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Please wait..." : "Send OTP"}
          </button>

          {otpSent && (
            <>
              <label className="mt-6 mb-2 block text-sm font-semibold text-slate-700">Enter 6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-black tracking-[0.5em] text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />

              <button
                type="button"
                onClick={verifyOtp}
                disabled={loading || otp.length !== 6}
                className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Verify & login
              </button>
            </>
          )}

          <div className="my-6 flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>Or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={loading}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with Google
          </button>

          {message && (
            <p className={`mt-5 rounded-2xl px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {message.text}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
