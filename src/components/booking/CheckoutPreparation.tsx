"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import CheckoutTransition from "./CheckoutTransition";
import { CHECKOUT_PENDING_KEY } from "@/lib/booking-handoff";
import type { BookingSelection } from "@/lib/booking";

export default function CheckoutPreparation() {
  const router = useRouter();
  const running = useRef(false);
  const [error, setError] = useState("");

  const prepare = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setError("");
    try {
      const saved = window.sessionStorage.getItem(CHECKOUT_PENDING_KEY);
      if (!saved) throw new Error("Your trip selection is missing. Please select the date and travellers again.");
      const selection = JSON.parse(saved) as BookingSelection;
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...selection, defer_quote: true }),
      });
      const result = await response.json() as { cart?: unknown; error?: string };
      if (!response.ok || !result.cart) throw new Error(result.error || "Could not prepare your checkout.");
      window.sessionStorage.removeItem(CHECKOUT_PENDING_KEY);
      router.replace("/checkout");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not prepare your checkout.");
      running.current = false;
    }
  }, [router]);

  useEffect(() => { const timer = window.setTimeout(() => { void prepare(); }, 0); return () => window.clearTimeout(timer); }, [prepare]);

  return <CheckoutTransition error={error} onRetry={() => void prepare()} />;
}
