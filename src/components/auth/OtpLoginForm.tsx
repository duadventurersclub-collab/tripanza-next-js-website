"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OtpLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setStep("otp");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid OTP");
      }

      // Successful verification! Redirect to dashboard.
      router.push("/dashboard");
      router.refresh(); // Force refresh to re-evaluate server components (like the layout checking cookies)
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
      <div className="bg-slate-900 p-8 text-center text-white">
        <h2 className="text-2xl font-black">
          {step === "email" ? "Welcome Back" : "Verify It's You"}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {step === "email"
            ? "Enter your email to receive a secure login code."
            : `We sent a code to ${email}`}
        </p>
      </div>

      <div className="p-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={handleSendOtp}>
            <div className="mb-6">
              <label htmlFor="email" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !email}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-4 text-sm font-bold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {isLoading ? (
                <i className="fa-solid fa-spinner fa-spin" />
              ) : (
                "Send Login Code"
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <div className="mb-6">
              <label htmlFor="otp" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Enter 4-Digit Code
              </label>
              <input
                id="otp"
                type="text"
                required
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="0000"
                className="w-full text-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-2xl font-black tracking-[0.5em] text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || otp.length < 4}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-4 text-sm font-bold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {isLoading ? (
                <i className="fa-solid fa-spinner fa-spin" />
              ) : (
                "Verify & Login"
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
