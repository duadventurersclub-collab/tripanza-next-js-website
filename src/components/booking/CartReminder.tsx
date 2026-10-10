"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import "./cart-reminder.css";

export default function CartReminder() {
  const pathname = usePathname();
  const [hasCart, setHasCart] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      fetch("/api/cart/status", { cache: "no-store", signal: controller.signal })
        .then(response => response.ok ? response.json() as Promise<{ has_cart: boolean }> : Promise.reject())
        .then(data => setHasCart(data.has_cart))
        .catch(() => { /* A temporary status error should not interrupt browsing. */ });
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("tripanza:cart-changed", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("tripanza:cart-changed", refresh);
    };
  }, [pathname]);

  if (!hasCart || /^\/(cart|checkout|resume-booking|payment|admin|host)(\/|$)/.test(pathname)) return null;

  return <Link href="/cart" className="tp-cart-reminder" aria-label="Continue your saved booking">
    <span className="tp-cart-reminder__icon" aria-hidden="true">✈</span>
    <span><strong>Trip in your cart</strong><small>Continue booking</small></span>
    <span className="tp-cart-reminder__arrow" aria-hidden="true">→</span>
  </Link>;
}
