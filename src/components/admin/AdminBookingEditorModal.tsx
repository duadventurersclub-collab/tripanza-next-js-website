"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BookingEditorData } from "@/lib/admin-booking-editor-types";
import type { BookingEditorModalControls } from "./AdminBookingEditor";
import "./booking-editor-modal.css";
const Editor = dynamic(() => import("./AdminBookingEditor"), { loading: () => <p className="be-modal-state" role="status">Opening editor controls…</p> });
export default function AdminBookingEditorModal({ id, wordpressOrigin, close, changed }: { id: number; wordpressOrigin: string; close: () => void; changed: (data: BookingEditorData) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), dismiss = useRef<() => void>(close);
  const [data, setData] = useState<BookingEditorData | null>(null), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const setDismissHandler = useCallback((handler: () => void) => { dismiss.current = handler; }, []);
  const modal = useMemo<BookingEditorModalControls>(() => ({ close, setDismissHandler }), [close, setDismissHandler]);
  useEffect(() => {
    const panel = dialog.current, previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; panel?.showModal();
    return () => { panel?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus({ preventScroll: true }); else { const heading = document.querySelector<HTMLElement>(".tz-topbar h1"); heading?.setAttribute("tabindex", "-1"); heading?.focus({ preventScroll: true }); } };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/admin/bookings/${id}/editor`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok || result.editor_api_version !== "1.0.0" || !result.fields || !result.financials) throw Error(result.message || "Could not load this booking. Update Tripanza Native Admin API to v2.2.0 if needed.");
        if (!controller.signal.aborted) setData(result);
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load the booking. Try again."); }
    })();
    return () => controller.abort();
  }, [id, attempt]);
  return createPortal(<dialog ref={dialog} className="be-modal-dialog" aria-modal="true" aria-labelledby="be-modal-title" onKeyDown={event => {
    if (event.key !== "Tab") return;
    const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(node => !node.matches(":disabled") && node.getClientRects().length > 0);
    if (!nodes.length) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
  }} onCancel={event => { event.preventDefault(); dismiss.current(); }} onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss.current(); }}>
    <header className="be-modal-header"><div><span>TRIPANZA / BOOKING HISTORY</span><h2 id="be-modal-title">Edit booking #{id}</h2></div><button type="button" aria-label="Close booking editor" onClick={() => dismiss.current()}>×</button></header>
    <div className="be-modal-body">{data ? <Editor initial={data} wordpressOrigin={wordpressOrigin} modal={modal} onChange={changed} /> : error ? <div className="be-modal-state"><p role="alert">{error}</p><button type="button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry loading booking</button></div> : <div className="be-modal-state" role="status"><span className="be-modal-spinner" aria-hidden="true" /> Loading saved booking…</div>}</div>
  </dialog>, document.body);
}
