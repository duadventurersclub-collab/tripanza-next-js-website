"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSiteSettings } from "./SiteSettingsProvider";
import "./cookie-consent.css";

type Choice = { analytics: boolean; marketing: boolean };
type PixelFunction = ((...args: unknown[]) => void) & { queue?: unknown[][]; loaded?: boolean; version?: string; callMethod?: (...args: unknown[]) => void; push?: PixelFunction };
type TrackWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: PixelFunction };
const STORAGE_KEY = "tripanza_cookie_choice_v1";
const PUBLIC_PATH = /^\/$|^\/(?:tours(?:\/[^/]+)?|trips|about|contact|host|cookies-policy|privacy-policy|tnc|disclaimer|cancellation-policy)\/?$/;

function appendScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export default function CookieConsent() {
  const settings = useSiteSettings();
  const pathname = usePathname();
  const gaId = /^G-[A-Z0-9]{4,20}$/.test(settings.ga4_measurement_id) ? settings.ga4_measurement_id : "";
  const pixelId = /^[0-9]{5,30}$/.test(settings.meta_pixel_id) ? settings.meta_pixel_id : "";
  const signature = `${gaId}|${pixelId}`;
  const previousSignature = useRef(signature);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (previousSignature.current !== signature && (document.getElementById("tripanza-ga4") || document.getElementById("tripanza-meta-pixel"))) {
      window.location.reload();
      return;
    }
    previousSignature.current = signature;
    if (!gaId && !pixelId) return;
    let saved: { signature?: string; analytics?: boolean; marketing?: boolean } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch { /* Storage may be blocked by the browser. */ }
    const prior = saved?.signature === signature && typeof saved.analytics === "boolean" && typeof saved.marketing === "boolean"
      ? { analytics: saved.analytics, marketing: saved.marketing } as Choice : null;
    queueMicrotask(() => {
      setChoice(prior);
      if (prior) { setAnalytics(prior.analytics); setMarketing(prior.marketing); }
      else setOpen(true);
    });
  }, [signature, gaId, pixelId]);

  useEffect(() => {
    const reopen = () => { setCustomize(true); setOpen(true); };
    window.addEventListener("tripanza:cookie-settings", reopen);
    return () => window.removeEventListener("tripanza:cookie-settings", reopen);
  }, []);

  useEffect(() => {
    if (!choice || !PUBLIC_PATH.test(pathname)) return;
    const browser = window as TrackWindow;
    const pageLocation = `${window.location.origin}${pathname}`;
    if (gaId && choice.analytics) {
      browser.dataLayer ||= [];
      browser.gtag ||= (...args: unknown[]) => { browser.dataLayer?.push(args); };
      if (!document.getElementById("tripanza-ga4")) {
        browser.gtag("js", new Date());
        browser.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
        browser.gtag("config", gaId, { send_page_view: false });
        appendScript("tripanza-ga4", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`);
      }
      browser.gtag("event", "page_view", { page_location: pageLocation, page_path: pathname, page_title: document.title });
    }
    if (pixelId && choice.marketing) {
      if (!browser.fbq) {
        const fbq = ((...args: unknown[]) => { if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue?.push(args); }) as PixelFunction;
        fbq.queue = []; fbq.loaded = true; fbq.version = "2.0"; fbq.push = fbq; browser.fbq = fbq;
        browser.fbq?.("init", pixelId);
        appendScript("tripanza-meta-pixel", "https://connect.facebook.net/en_US/fbevents.js");
      }
      browser.fbq?.("track", "PageView");
    }
  }, [choice, gaId, pixelId, pathname]);

  if (!gaId && !pixelId) return null;
  const save = (next: Choice) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, signature })); } catch { /* Session-only choice if storage is unavailable. */ }
    const withdrawing = (choice?.analytics && !next.analytics) || (choice?.marketing && !next.marketing);
    setChoice(next);
    setOpen(false);
    if (withdrawing) {
      for (const cookie of document.cookie.split(";")) {
        const name = cookie.split("=")[0]?.trim();
        if (name && (/^_ga(?:_|$)/.test(name) || name === "_fbp" || name === "_fbc")) {
          document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
          document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${window.location.hostname}; SameSite=Lax`;
        }
      }
      window.location.reload();
    }
  };
  if (!open) return null;
  return <div className="tp-cookie-backdrop" role="presentation">
    <section className="tp-cookie-panel" role="dialog" aria-modal="true" aria-labelledby="tp-cookie-title">
      <h2 id="tp-cookie-title">Your privacy choices</h2>
      <p>Tripanza uses necessary storage to run the site. With your choice, we can also use {gaId && "Google Analytics to understand visits"}{gaId && pixelId && " and "}{pixelId && "Meta Pixel to measure advertising"}. Optional tracking is off until you agree.</p>
      {customize && <div className="tp-cookie-options">
        {gaId && <label><input type="checkbox" checked={analytics} onChange={event => setAnalytics(event.target.checked)} /> Analytics (Google Analytics 4)</label>}
        {pixelId && <label><input type="checkbox" checked={marketing} onChange={event => setMarketing(event.target.checked)} /> Marketing (Meta Pixel)</label>}
      </div>}
      <div className="tp-cookie-actions">
        <button type="button" onClick={() => save({ analytics: false, marketing: false })}>Reject optional</button>
        {customize ? <button type="button" onClick={() => save({ analytics: gaId ? analytics : false, marketing: pixelId ? marketing : false })}>Save choices</button> : <button type="button" onClick={() => setCustomize(true)}>Customize</button>}
        <button type="button" className="tp-cookie-accept" onClick={() => save({ analytics: !!gaId, marketing: !!pixelId })}>Accept all</button>
      </div>
      <a href="/cookies-policy">Read our Cookie Policy</a>
    </section>
  </div>;
}
