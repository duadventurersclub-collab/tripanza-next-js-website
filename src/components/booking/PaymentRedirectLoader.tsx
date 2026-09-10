"use client";

import { useEffect, useState } from "react";

export default function PaymentRedirectLoader() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-6 text-center text-white">
      <div className="relative z-10 w-full max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]">
          <i className="fa-solid fa-lock text-2xl text-white" aria-hidden="true" />
        </div>
        
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-900/30 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          </span>
          Secure Connection
        </span>

        <h2 className="mb-3 text-3xl font-black tracking-tight sm:text-4xl">
          Taking you to payment{dots}
        </h2>
        <p className="mx-auto mb-8 max-w-xs text-sm font-medium text-slate-300">
          Please do not refresh this page or click back while we securely provision your booking.
        </p>

        <div className="mx-auto h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-[slide_1.5s_ease-in-out_infinite] rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"></div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slide {
          0% { transform: translateX(-150%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(350%); }
        }
      `}} />
    </div>
  );
}
