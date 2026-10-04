"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import AdminMenu from "./AdminMenu";
import AdminBookingEditorModal from "./AdminBookingEditorModal";
import { customBookingTotal, emptyCreateFields, type BookingCreateData, type BookingCreateFields, type BookingMode } from "@/lib/admin-booking-create-types";
import "./booking-manager-original.css";
import "./booking-manager-native.css";
const Icon = ({ name }: { name: string }) => <i aria-hidden="true" className={`fas ${name}`} />;
export default function AdminBookingCreate({ initial, initialMode, wordpressOrigin }: { initial: BookingCreateData; initialMode: BookingMode; wordpressOrigin: string }) {
  const [mode, setMode] = useState(initialMode), [drafts, setDrafts] = useState({ standard: emptyCreateFields("standard"), custom: emptyCreateFields("custom") });
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [created, setCreated] = useState<number | null>(null), [overlay, setOverlay] = useState(false), [editor, setEditor] = useState<number | null>(null), [searchOpen, setSearchOpen] = useState(false), [query, setQuery] = useState("");
  const pending = useRef(false), attempt = useRef<{ signature: string; payload: Record<string, unknown> } | null>(null), result = useRef<HTMLDivElement>(null);
  const fields = drafts[mode], total = customBookingTotal(fields), available = mode === "standard" ? initial.standard_available : initial.custom_available;
  const prerequisites = initial.custom_prerequisites;
  const missing = prerequisites ? [
    !prerequisites.template_exists && `Source post #${initial.custom_template_id} is missing in WordPress.`,
    !prerequisites.order_type_available && "Traveler order post type is unavailable.",
    !prerequisites.traveler_table_available && "Traveler order item table is unavailable.",
  ].filter(Boolean).join(" ") : "Update the Tripanza Native Admin API plugin to v2.3.1 to see which booking prerequisite is missing.";
  const locked = busy || uncertain || Boolean(created), dirty = JSON.stringify(drafts.standard) !== JSON.stringify(emptyCreateFields("standard")) || JSON.stringify(drafts.custom) !== JSON.stringify(emptyCreateFields("custom"));
  const closeEditor = useCallback(() => setEditor(null), []);
  const editorChanged = useCallback(() => { try { sessionStorage.setItem("tripanza-admin-bookings-changed", "1"); } catch {} }, []);
  useEffect(() => {
    if (!overlay) return;
    const timer = setTimeout(() => { setOverlay(false); result.current?.focus(); result.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 1100);
    return () => clearTimeout(timer);
  }, [overlay]);
  useEffect(() => {
    if (!busy && !uncertain && (!dirty || created)) return;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.getAttribute("href")?.startsWith("#")) return;
      if (pending.current || uncertain) { event.preventDefault(); event.stopImmediatePropagation(); setNotice({ text: "Wait for booking confirmation or retry this same request before leaving.", error: true }); }
      else if (!window.confirm("Leave and discard the unsaved booking form?")) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [busy, uncertain, dirty, created]);
  function change<K extends keyof BookingCreateFields>(key: K, value: BookingCreateFields[K]) { setDrafts(previous => ({ ...previous, [mode]: { ...previous[mode], [key]: value } })); }
  function tab(next: BookingMode) { if (locked) return; setMode(next); setNotice(null); setQuery(next === "standard" ? initial.tours.find(tour => tour.id === drafts.standard.selected_tour_id)?.name || "" : ""); setSearchOpen(false); }
  async function generate(retry = false) {
    if (pending.current || created || !available || uncertain && !retry) return;
    if (!retry && (!fields.selected_tour_id && mode === "standard" || fields.adults + fields.children + fields.infants < 1)) { setNotice({ text: !fields.selected_tour_id && mode === "standard" ? "Select a tour from the search results." : "Add at least one traveller.", error: true }); return; }
    if (!retry && mode === "custom" && (total <= 0 || fields.advance_payment !== "" && Number(fields.advance_payment) > total || fields.check_out < fields.check_in)) { setNotice({ text: "Check the package price, advance amount and travel dates.", error: true }); return; }
    const signature = JSON.stringify({ mode, fields });
    if (!retry && attempt.current?.signature !== signature) attempt.current = { signature, payload: { mode, fields: structuredClone(fields), nonce: initial.nonce, request_id: crypto.randomUUID() } };
    if (!attempt.current) return;
    pending.current = true; setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/bookings/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(attempt.current.payload) });
      const data = await response.json();
      if (!response.ok || !data.ok || !Number.isSafeInteger(data.order_id) || data.order_id < 1) {
        setUncertain(Boolean(data.uncertain || data.data?.uncertain || response.status >= 500));
        throw Error(data.message || "Could not confirm booking creation. Retry the same request, not a new booking.");
      }
      setUncertain(false); setCreated(data.order_id); setOverlay(true); setNotice({ text: [data.message, data.warning].filter(Boolean).join(" "), error: Boolean(data.warning) });
      try { sessionStorage.setItem("tripanza-admin-bookings-changed", "1"); } catch {}
    } catch (error) { if (!(error instanceof Error) || error.name === "TypeError" || error.name === "SyntaxError") setUncertain(true); setNotice(previous => previous || { text: error instanceof Error ? error.message : "Creation was not confirmed. Retry the same request.", error: true }); }
    finally { pending.current = false; setBusy(false); }
  }
  function reset() { if (pending.current || uncertain) return; setDrafts(previous => ({ ...previous, [mode]: emptyCreateFields(mode) })); setCreated(null); setNotice(null); setQuery(""); attempt.current = null; }
  function input(key: Exclude<keyof BookingCreateFields, "guests">, label: string, type = "text", options: { required?: boolean; placeholder?: string; min?: number | string; max?: number; step?: string; id?: string; help?: string } = {}) {
    const id = options.id || `bm_${mode}_${key}`;
    return <div className="form-group" key={key}><label htmlFor={id}>{label}</label><input id={id} type={type} name={key} value={fields[key]} required={options.required} placeholder={options.placeholder} min={options.min} max={options.max} step={options.step} maxLength={type === "number" ? undefined : key === "email" ? 254 : 200} onChange={event => change(key, type === "number" && key !== "advance_payment" ? Number(event.target.value) : event.target.value)} />{options.help && <small>{options.help}</small>}</div>;
  }
  const row = (...children: ReactNode[]) => <div className="form-row">{children}</div>;
  const section = (title: string, icon: string, children: ReactNode) => <div className="tp-form-section"><h4 className="tp-form-section__title"><Icon name={icon} /> {title}</h4>{children}</div>;
  const contact = <>{row(input("first_name", "First Name", "text", { required: true }), input("last_name", "Last Name"))}{row(input("email", "Email", "email", { required: true }), input("phone", "Phone", "text", { required: true, placeholder: "+91 98765 43210" }))}</>;
  const tours = initial.tours.filter(tour => tour.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="native-booking-manager"><AdminMenu name={initial.user.name} wordpressOrigin={wordpressOrigin} />
    <div id="bm_success_overlay" className={overlay ? "active" : ""} aria-hidden={!overlay} role="status"><div className="success-checkmark"><div className="check-icon"><span className="icon-line line-tip" /><span className="icon-line line-long" /></div></div><h2 id="bm_overlay_text">Booking Generated Successfully!</h2></div>
    <main className="tripanza-booking-dashboard"><div className="tp-dashboard-hero"><div className="tp-dashboard-hero__content"><span className="tp-dashboard-badge"><Icon name="fa-calendar-check" /> Booking Manager</span><h1 className="tp-dashboard-title">Create &amp; Manage Bookings</h1><p className="tp-dashboard-subtitle">Generate standard tour bookings or customized packages with automatic invoice delivery to customers.</p></div><Link className="bm-history-link" href="/admin/bookings">← Booking History</Link></div>
      <nav className="tp-dashboard-tabs" aria-label="Booking type">{(["standard", "custom"] as const).map(value => <button key={value} type="button" className={`tp-dashboard-tab${mode === value ? " is-active" : ""}`} aria-pressed={mode === value} disabled={locked} onClick={() => tab(value)}><Icon name={value === "standard" ? "fa-box" : "fa-wrench"} /> {value === "standard" ? "Standard Tour" : "Custom Package"}</button>)}</nav>
      <div className="tp-panel"><div className="tp-panel__header"><div><h2>{mode === "standard" ? "Book Standard Tour" : "Book Custom Package"}</h2><p>{mode === "standard" ? "Search an admin tour, pick a departure date, and create a booking instantly." : "Build a tailored itinerary with custom pricing and send the invoice automatically."}</p></div></div><div className="tp-panel__body">
        {!available && <p className="bm-native-notice is-error" role="alert">{mode === "standard" ? prerequisites && (!prerequisites.order_type_available || !prerequisites.traveler_table_available) ? "Traveler order storage is unavailable. Check that Traveler is active and its order item table exists." : "The existing tripanza_create_tour_booking function is unavailable. Activate its booking module in WordPress." : missing}</p>}
        {!initial.mail_available && <p className="bm-native-notice" role="status">Traveler email delivery is unavailable. Creation will not confirm invoice delivery.</p>}
        {notice && <p className={`bm-native-notice${notice.error ? " is-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
        <form id={mode === "standard" ? "bm_standard_form" : "bm_custom_form"} className="bm-form" onSubmit={event => { event.preventDefault(); void generate(); }}><fieldset disabled={locked || !available} className="bm-native-fields">
          {mode === "standard" ? <>{section("Tour Selection", "fa-map-marked-alt", <>{row(<div className="form-group full-width"><label htmlFor="bm_tour_search">Search &amp; Select Tour</label><input id="bm_tour_search" type="text" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" value={query} placeholder="Type tour name to search..." autoComplete="off" required aria-controls="bm_tour_results" aria-expanded={searchOpen && query.trim().length >= 2} onChange={event => { setQuery(event.target.value); change("selected_tour_id", 0); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onBlur={event => { if (!(event.relatedTarget as Element | null)?.closest("#bm_tour_results")) setSearchOpen(false); }} onKeyDown={event => { if (event.key === "Escape") setSearchOpen(false); if (event.key === "ArrowDown") { event.preventDefault(); document.querySelector<HTMLButtonElement>("#bm_tour_results button")?.focus(); } }} /><div id="bm_tour_results" role="listbox" aria-label="Admin tours" className="bm-tour-dropdown" hidden={!searchOpen || query.trim().length < 2} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}>{tours.length ? tours.map(tour => <button key={tour.id} type="button" role="option" aria-selected={fields.selected_tour_id === tour.id} className="bm-tour-item tour-item" onMouseDown={event => event.preventDefault()} onClick={() => { change("selected_tour_id", tour.id); setQuery(tour.name); document.getElementById("bm_tour_search")?.focus(); setSearchOpen(false); }}>{tour.name}</button>) : <div className="bm-tour-empty">No admin tours found matching this name.</div>}</div><input type="hidden" id="bm_selected_tour_id" name="selected_tour_id" value={fields.selected_tour_id || ""} /></div>)}<div className="form-row" id="tour-calendar-wrapper">{input("check_in", "Departure Date", "date", { required: true, id: "tour_date_picker" })}</div></>)}{section("Customer Details", "fa-user", contact)}{section("Occupancy", "fa-users", row(input("adults", "Quad", "number", { min: 0, max: 5000 }), input("children", "Triple", "number", { min: 0, max: 5000 }), input("infants", "Twin", "number", { min: 0, max: 5000 })))}</> : <>
            {section("Package Details", "fa-suitcase", <>{row(<div className="form-group full-width">{input("custom_package_name", "Custom Package Name", "text", { required: true, placeholder: "e.g., Spiti Valley Expedition" })}</div>)}{contact}</>)}
            {section("Travel Schedule", "fa-route", <>{row(input("check_in", "Travel Start Date", "date", { required: true }), input("check_out", "Travel End Date", "date", { required: true, min: fields.check_in }), input("duration", "Duration", "text", { required: true, placeholder: "e.g., 3 Days / 2 Nights" }))}{row(input("boarding", "Boarding Location", "text", { placeholder: "e.g., Delhi Airport" }), input("dropoff", "Drop-off Location", "text", { placeholder: "e.g., Manali Bus Stand" }))}</>)}
            {section("Pricing & Occupancy", "fa-rupee-sign", <>{row(input("quad_price", "Quad Price Per Person (₹)", "number", { min: 0, step: ".01", id: "quad_price" }), input("triple_price", "Triple Price Per Person (₹)", "number", { min: 0, step: ".01", id: "triple_price" }), input("twin_price", "Twin Price Per Person (₹)", "number", { min: 0, step: ".01", id: "twin_price" }))}{row(input("adults", "No. of Persons on Quad", "number", { min: 0, max: 5000, id: "pax_quad" }), input("children", "No. of Persons on Triple", "number", { min: 0, max: 5000, id: "pax_triple" }), input("infants", "No. of Persons on Twin", "number", { min: 0, max: 5000, id: "pax_twin" }))}<div className="tp-pricing-summary"><p className="tp-pricing-summary__label">Grand Total (₹)</p><input id="calculated_grand_total" type="text" className="tp-pricing-summary__value" readOnly aria-label="Grand Total" value={total.toFixed(2)} /></div>{row(input("advance_payment", "Advance Payment (₹)", "number", { min: 0, max: total, step: ".01", placeholder: "Leave empty if fully paid", help: "If left blank, the full package amount is recorded as advance. Enter 0 to record no advance." }), input("balance_due_days", "Balance Due (Days Before Travel)", "number", { min: 0, max: 3650, placeholder: "e.g., 7", help: "How many days before check-in the balance payment is due." }))}</>)}
          </>}
          {section("Traveller Names", "fa-id-card", <><div id={mode === "standard" ? "standardGuestListContainer" : "createCustomGuestListContainer"}>{fields.guests.map((guest, index) => <div className="guest-row" data-index={index} key={index}>{index > 0 && <button type="button" className={mode === "standard" ? "remove-std-guest-btn" : "remove-custom-guest-btn"} aria-label={`Remove traveller ${index + 1}`} onClick={() => change("guests", fields.guests.filter((_, position) => position !== index))}><Icon name="fa-times" /> Remove</button>}<div className="guest-row__fields"><div className="form-group guest-row__title"><label htmlFor={`bm_title_${index}`}>Title</label><select id={`bm_title_${index}`} name={`guest_title[${index}]`} value={guest.title} onChange={event => change("guests", fields.guests.map((value, position) => position === index ? { ...value, title: event.target.value as "mr" | "miss" } : value))}><option value="mr">Male</option><option value="miss">Female</option></select></div><div className="form-group guest-row__name"><label htmlFor={`bm_guest_${index}`}>Full Name (Age)</label><input id={`bm_guest_${index}`} type="text" name={`guest_name[${index}]`} maxLength={200} placeholder="First Last | Age" value={guest.name} onChange={event => change("guests", fields.guests.map((value, position) => position === index ? { ...value, name: event.target.value } : value))} /></div></div></div>)}</div><button type="button" id={mode === "standard" ? "addStandardGuestBtn" : "addCreateCustomGuestBtn"} disabled={fields.guests.length >= 100} onClick={() => change("guests", [...fields.guests, { title: "mr", name: "" }])}><Icon name="fa-plus" /> Add Another Traveller</button></>)}
          {!created && <button type="submit" id={mode === "standard" ? "bm_submit_standard_btn" : "bm_submit_custom_btn"} className="btn-green"><Icon name={busy ? "fa-spinner fa-spin" : mode === "standard" ? "fa-check-circle" : "fa-paper-plane"} /> {busy ? "Generating…" : mode === "standard" ? "Generate Booking" : "Generate Custom Booking & Send Invoice"}</button>}
        </fieldset></form>
        {uncertain && <div className="bm-native-notice is-error"><p>Creation has not been confirmed. Your form is locked to prevent a duplicate booking. Retry checks the same request.</p><button type="button" className="btn-green" disabled={busy} onClick={() => void generate(true)}>{busy ? "Checking…" : "Retry same request"}</button><Link href="/admin/bookings" target="_blank">Check booking history in a new tab ↗</Link></div>}
        {created && <div ref={result} tabIndex={-1} className="bm-created-booking-actions" id="bm_created_booking_actions"><p><Icon name="fa-check-circle" /> Booking #{created} created successfully. What would you like to do next?</p><div><button type="button" id="bm_edit_created_booking" onClick={() => setEditor(created)}><Icon name="fa-edit" /> Edit Booking</button><button type="button" id="bm_create_new_booking" onClick={reset}><Icon name="fa-plus" /> Create New Booking</button><Link href="/admin/bookings">Booking History</Link></div></div>}
      </div></div>
    </main>{editor && <AdminBookingEditorModal key={editor} id={editor} wordpressOrigin={wordpressOrigin} close={closeEditor} changed={editorChanged} />}
  </div>;
}
