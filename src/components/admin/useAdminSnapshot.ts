"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_AGE_MS = 15 * 60_000;

export function useAdminSnapshot<T>(userId: number, kind: string, url: string, valid: (value: unknown, userId: number) => value is T) {
  const key = `tripanza-admin-snapshot-v1:${userId}:${kind}`;
  const [data, setData] = useState<T | null>(null);
  const [checking, setChecking] = useState(true);
  const [live, setLive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  const inFlight = useRef(false);
  const lastFetch = useRef(0);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(35_000) });
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem(key);
        window.location.replace("/");
        return;
      }
      const result: unknown = await response.json();
      if (!response.ok || !valid(result, userId)) throw new Error("Live data is unavailable. Please try again.");
      if (!active.current) return;
      setData(result);
      setLive(true);
      setError("");
      lastFetch.current = Date.now();
      try { sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data: result })); } catch { /* Storage may be full or disabled. */ }
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : "Live data is unavailable.");
    } finally {
      inFlight.current = false;
      if (active.current) setRefreshing(false);
    }
  }, [key, url, userId, valid]);

  useEffect(() => {
    active.current = true;
    void Promise.resolve().then(() => {
      if (!active.current) return;
      try {
        const snapshot = JSON.parse(sessionStorage.getItem(key) || "null");
        if (snapshot && Date.now() - snapshot.savedAt < MAX_AGE_MS && valid(snapshot.data, userId)) setData(snapshot.data);
        else sessionStorage.removeItem(key);
      } catch { try { sessionStorage.removeItem(key); } catch {} }
      setChecking(false);
      void refresh();
    });
    const onFocus = () => { if (Date.now() - lastFetch.current > 60_000) void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { active.current = false; window.removeEventListener("focus", onFocus); };
  }, [key, refresh, userId, valid]);

  const remember = useCallback((next: T) => {
    setData(next);
    if (valid(next, userId)) {
      try { sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data: next })); } catch {}
    }
  }, [key, userId, valid]);

  return { data, checking, live, refreshing, error, refresh, remember };
}

export function clearAdminSnapshots() {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith("tripanza-admin-snapshot-v1:")) sessionStorage.removeItem(key);
    }
  } catch {}
}
