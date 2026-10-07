"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type JourneyPreference = "checking" | "enabled" | "disabled" | "opted_out" | "unavailable";

export function useJourneyPreference(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const [saved, setSaved] = useState<{ digits: string; state: JourneyPreference }>({ digits: "", state: "disabled" });
  const requestVersion = useRef(0);

  useEffect(() => {
    if (digits.length < 10 || digits.length > 15) return;
    const version = ++requestVersion.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/journey/preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phone.trim() }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Preference lookup failed");
        const data = await response.json() as { state?: JourneyPreference };
        if (!controller.signal.aborted && version === requestVersion.current) {
          setSaved({ digits, state: data.state === "enabled" || data.state === "opted_out" ? data.state : "disabled" });
        }
      } catch {
        if (!controller.signal.aborted && version === requestVersion.current) setSaved({ digits, state: "unavailable" });
      }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [digits, phone]);

  const state: JourneyPreference = digits.length < 10 || digits.length > 15
    ? "disabled"
    : saved.digits === digits ? saved.state : "checking";

  const update = useCallback((state: JourneyPreference) => {
    requestVersion.current++;
    setSaved({ digits, state });
  }, [digits]);

  return { state, update };
}

export async function journeyEvent(event: string, fields: Record<string, unknown> = {}) {
  const response = await fetch("/api/journey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...fields }),
  });
  if (!response.ok) throw new Error("WhatsApp preference could not be saved.");
}
