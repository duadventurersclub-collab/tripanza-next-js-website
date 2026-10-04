"use client";
/* eslint-disable @next/next/no-img-element -- original dashboard logo */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clearAdminSnapshots } from "./useAdminSnapshot";
import AdminMenu from "./AdminMenu";
import AdminRevenueChart from "./AdminRevenueChart";
import AdminMultipleDates from "./AdminMultipleDates";
import { ADMIN_MONTHS, dashboardAnalytics, rupees, taskTimeframe, type AdminWorkspace, type AdminAction, type AdminTask } from "@/lib/admin-dashboard-types";
import "./admin-dashboard-original.css";
import "./admin-dashboard-native.css";

const Icon = ({ name }: { name: string }) => <i className={`fa-solid ${name}`} aria-hidden="true" />;
const holidayFilters = [["all", "All Trips"], ["general", "Long Weekends"], ["festive", "Festive"], ["du", "DU Trips"], ["ipu", "IPU Trips"], ["amity", "Amity Trips"], ["mumbai", "Mumbai/Pune Trips"], ["gujarat", "Gujarat Trips"], ["bangalore", "Bangalore Trips"], ["corporate", "Corporate 9-5"], ["custom", "Custom"]];
const presets = [["long_weekends", "Long Weekends", "fa-calendar-plus"], ["festive", "Festive Weekends", "fa-champagne-glasses"], ["du", "DU Trips", "fa-graduation-cap"], ["ipu", "IPU Trips", "fa-university"], ["amity", "Amity Trips", "fa-school"], ["mumbai", "Mumbai & Pune Trips", "fa-city"], ["gujarat", "Gujarat Trips", "fa-compass"], ["bangalore", "Bangalore & South Trips", "fa-laptop-code"], ["corporate", "Corporate 9-5 Getaways", "fa-briefcase"]];
function Filters({ id, options, value, onChange }: { id: string; options: string[][]; value: string; onChange: (value: string) => void }) {
  return <div id={id} className="filter-bar">{options.map(([key, label]) => <button key={key} type="button" className={`filter-pill${value === key ? " active" : ""}`} aria-pressed={value === key} onClick={() => onChange(key)}>{label}</button>)}</div>;
}
function errorMessage(data: { message?: string; data?: { message?: string; msg?: string } }) { return data?.message || data?.data?.message || data?.data?.msg || "The request could not be completed. Please try again."; }
export default function AdminDashboard({ initial, wordpressOrigin, readOnly = false, onDataChange }: { initial: AdminWorkspace; wordpressOrigin: string; readOnly?: boolean; onDataChange?: (data: AdminWorkspace) => void }) {
  const [state, setState] = useState(initial);
  const [previousInitial, setPreviousInitial] = useState(initial);
  if (initial !== previousInitial) { setPreviousInitial(initial); setState(initial); }
  useEffect(() => { onDataChange?.(state); }, [state, onDataChange]);
  const [year, setYear] = useState(initial.today.slice(0, 4)), [month, setMonth] = useState("all");
  const [planFilter, setPlanFilter] = useState("all"), [holidayFilter, setHolidayFilter] = useState("all"), [taskFilter, setTaskFilter] = useState("all");
  const [tripName, setTripName] = useState(""), [dates, setDates] = useState<string[]>([]);
  const [taskText, setTaskText] = useState(""), [taskDate, setTaskDate] = useState("");
  const [search, setSearch] = useState(""), [searchOpen, setSearchOpen] = useState(false), [tourId, setTourId] = useState(0);
  const [email, setEmail] = useState(""), [phone, setPhone] = useState(""), [departure, setDeparture] = useState("");
  const [notice, setNotice] = useState<{ message: string; error: boolean; scope: string } | null>(null);
  const [busy, setBusy] = useState("");
  const pending = useRef(false), retries = useRef(new Map<string, string>());
  const currentYear = Number(state.today.slice(0, 4));
  const metrics = dashboardAnalytics(state.bookings, currentYear, year, month);
  const plans = state.plans.filter(plan => planFilter === "all" || plan.month === planFilter);
  const holidays = state.holidays.filter(holiday => holidayFilter === "all" || holiday.category === holidayFilter);
  const tasks = state.tasks.filter(task => taskFilter === "all" || (taskFilter === "completed" ? task.status === "completed" : task.status !== "completed" && taskTimeframe(task, state.today) === taskFilter));
  const tour = state.tours.find(item => item.id === tourId);
  const matches = state.tours.filter(item => item.title.toLowerCase().includes(search.trim().toLowerCase()));
  function merge(data: Partial<AdminWorkspace>) { setState(previous => ({ ...previous, ...(Array.isArray(data.tasks) ? { tasks: data.tasks } : {}), ...(Array.isArray(data.plans) ? { plans: data.plans } : {}), ...(Array.isArray(data.holidays) ? { holidays: data.holidays } : {}) })); }
  async function mutate(action: AdminAction, fields: Record<string, string | number>, scope: string, busyKey: string = action): Promise<boolean> {
    if (pending.current) return false;
    pending.current = true; setBusy(busyKey); setNotice(null);
    const fingerprint = JSON.stringify([action, fields]);
    if (!retries.current.has(fingerprint)) retries.current.set(fingerprint, crypto.randomUUID());
    try {
      const response = await fetch("/api/admin/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, action, nonce: state.nonce, request_key: retries.current.get(fingerprint) }), cache: "no-store", signal: AbortSignal.timeout(50_000) });
      const data = await response.json();
      if (!response.ok || data?.success === false) throw new Error(errorMessage(data));
      merge(data); retries.current.delete(fingerprint);
      setNotice({ message: data?.message || data?.data?.message || "Changes saved.", error: false, scope });
      return true;
    } catch (error) { setNotice({ message: error instanceof Error ? error.message : "The request failed. Please try again.", error: true, scope }); return false; }
    finally { pending.current = false; setBusy(""); }
  }
  async function toggle(task: AdminTask) {
    if (pending.current) return;
    const status = task.status === "completed" ? "pending" : "completed";
    setState(previous => ({ ...previous, tasks: previous.tasks.map(item => item.id === task.id ? { ...item, status } : item) }));
    if (!await mutate("toggle_todo", { todo_id: task.id, status }, "tasks", `task-${task.id}`)) setState(previous => ({ ...previous, tasks: previous.tasks.map(item => item.id === task.id ? { ...item, status: task.status } : item) }));
  }
  async function refresh() {
    if (pending.current) return;
    pending.current = true; setBusy("refresh");
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" }); const data = await response.json();
      if (!response.ok || data?.api_version !== "2.0.0") throw new Error(errorMessage(data));
      setState(data); setNotice({ message: "Dashboard refreshed.", error: false, scope: "dashboard" });
    } catch (error) { setNotice({ message: error instanceof Error ? error.message : "Unable to refresh.", error: true, scope: "dashboard" }); }
    finally { pending.current = false; setBusy(""); }
  }
  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    if (!response?.ok) { setNotice({ message: "Could not sign out. Please try again.", error: true, scope: "dashboard" }); return; }
    clearAdminSnapshots();
    // Clear private React and router state after logout, including on a shared device.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }
  const status = (scope: string) => notice?.scope === scope ? <p className={`native-admin-notice${notice.error ? " is-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.message}</p> : null;
  return <div className="native-admin-dashboard">
    <AdminMenu name={state.user.name} wordpressOrigin={wordpressOrigin} />
    <main className="tripanza-admin-dashboard" inert={readOnly}>
      <div className="tp-dashboard-hero"><img className="tp-welcome-logo" src="https://tripanza.com/wp-content/uploads/2026/04/Tripanza-Logo-3.png" alt="Tripanza Logo" /><div className="tp-dashboard-hero__content"><span className="tp-dashboard-badge"><Icon name="fa-gauge-high" /> Admin Hub</span><h1 className="tp-dashboard-title">Welcome to Tripanza Dashboard</h1><p className="tp-dashboard-subtitle">Analytics, team tasks, trip planning, and quick admin tools in one place.</p>{state.intro && <div className="tp-dashboard-intro" dangerouslySetInnerHTML={{ __html: state.intro }} />}</div></div>
      {status("dashboard")}
      <section className="tp-panel"><div className="tp-panel__header"><h2><Icon name="fa-chart-line" /> Confirmed Bookings Performance</h2><p>Revenue and occupancy from fully paid and partially paid bookings.</p></div><div className="tp-panel__body">
        {!state.capabilities.analytics && <p className="native-admin-notice is-error" role="alert">Traveler booking analytics is unavailable. Activate the Traveler booking modules.</p>}
        <div className="tz-analytics-section" id="tzAnalyticsSection"><div className="tz-analytics-header"><h3 className="tz-analytics-title"><Icon name="fa-chart-line" /> Filters</h3><div className="tz-analytics-filters"><select id="tzYearFilter" aria-label="Analytics year" className="tz-analytics-select" value={year} onChange={event => setYear(event.target.value)}><option value="all">All Years</option>{metrics.years.map(value => <option key={value} value={value}>{value}</option>)}</select><select id="tzMonthFilter" aria-label="Analytics month" className="tz-analytics-select" value={month} onChange={event => setMonth(event.target.value)}><option value="all">All Months</option>{ADMIN_MONTHS.map((value, index) => <option key={value} value={index}>{value}</option>)}</select><button type="button" className="tz-analytics-select" disabled={!!busy} onClick={refresh}>{busy === "refresh" ? "Refreshing…" : "Refresh data"}</button></div></div>
          <div className="tz-cards-grid">{[["confirmed", "fa-circle-check", "Total Confirmed Bookings", metrics.count.toLocaleString("en-IN"), "tzValConfirmed"], ["revenue", "fa-wallet", "Total Revenue (Confirmed Bookings)", rupees(metrics.revenue), "tzValRevenue"], ["persons", "fa-user-group", "Total Number of Persons", metrics.persons.toLocaleString("en-IN"), "tzValPersons"]].map(([tone, icon, label, value, id]) => <div className="tz-card" key={tone}><div className={`tz-card-icon tz-icon-${tone}`}><Icon name={icon} /></div><div className="tz-card-info"><div className="tz-card-label">{label}</div><div className="tz-card-value" id={id} aria-live="polite">{state.capabilities.analytics ? value : "—"}</div></div></div>)}</div>
          <div className="tz-chart-wrapper"><div className="tz-chart-header"><span><Icon name="fa-chart-column" /> Monthly Revenue Comparison (Last 2 Years)</span><span className="tz-chart-note">Fully Paid + Partially Paid</span></div><div className="tz-chart-canvas-container"><AdminRevenueChart current={metrics.current} previous={metrics.previous} year={currentYear} /></div></div>
        </div></div></section>
      <div className="nav-links-grid">{[["/admin", "fa-gauge-high", "Main Dashboard"], ["/add-your-own-trip", "fa-circle-plus", "Add Trips"], ["/admin/bookings", "fa-users", "Booking History"], ["/poster-download", "fa-map-location-dot", "Poster Download"], [wordpressOrigin + "/crm/", "fa-ticket", "CRM / Leads"], ["/admin/bookings/create", "fa-gears", "Create Booking"], ["/", "fa-house", "Tripanza Home"]].map(([href, icon, label]) => href.startsWith("/") ? <Link href={href} className={`nav-card${href === "/" ? " nav-outline" : ""}`} key={href}><Icon name={icon} /><span>{label}</span></Link> : <a href={href} className="nav-card" key={href}><Icon name={icon} /><span>{label}</span></a>)}<button type="button" className="nav-card nav-danger" onClick={logout}><Icon name="fa-right-from-bracket" /><span>Logout</span></button></div>
      <div className="dashboard-grid">
        <section className="widget-card widget-full-width"><h3><Icon name="fa-map-location-dot" /> Future Trip Planner</h3><Filters id="trip-filters" options={[["all", "All Months"], ...["September", "October", "November", "December", "January"].map(label => [label.toLowerCase(), label])]} value={planFilter} onChange={setPlanFilter} />
          <form className="todo-form" id="ajax-trip-form" onSubmit={async event => { event.preventDefault(); if (!dates.length) { setNotice({ message: "Choose at least one departure date.", error: true, scope: "plans" }); return; } const name = tripName; const selected = dates; if (await mutate("add_future_trip", { trip_name: name, trip_dates: selected.join(",") }, "plans")) { setTripName(value => value === name ? "" : value); setDates(value => value === selected ? [] : value); } }}><input type="text" aria-label="Trip destination" placeholder="Trip Destination (e.g., Manali & Chopta)" required maxLength={2000} value={tripName} onChange={event => setTripName(event.target.value)} /><AdminMultipleDates dates={dates} onChange={setDates} today={state.today} /><button type="submit" disabled={!!busy}><Icon name="fa-plus" /> {busy === "add_future_trip" ? "Saving…" : "Add Plan"}</button></form>{status("plans")}
          <ul className="scrollable-list trip-list" id="future-trip-list">{plans.map(plan => <li className="weekend-item trip-item" key={plan.id}><div className="date-badge trip-month">{plan.month.slice(0, 3).replace(/^./, character => character.toUpperCase())}</div><div className="weekend-info"><h4>{plan.name}</h4><p>{plan.dates} <span className="trip-author-note">(by {plan.author})</span></p></div><button type="button" className="todo-action-btn delete-trip" aria-label={`Delete trip plan ${plan.name}`} disabled={!!busy} onClick={() => { if (window.confirm("Delete this trip plan?")) void mutate("delete_future_trip", { trip_id: plan.id }, "plans"); }}><Icon name="fa-trash-can" /></button></li>)}{!plans.length && <li className="empty-state is-visible">No upcoming trips match this filter.</li>}</ul>
        </section>
        <section className="widget-card"><h3><Icon name="fa-calendar-days" /> Upcoming Trip Opportunities (Target 18-35 Youth)</h3><div className="ai-preset-pills-header"><span className="ai-preset-pills-label"><Icon name="fa-wand-magic-sparkles" /> AI Fetch & Store Presets (Tier 1 & Tier 2 Cities)</span><button type="button" className="tp-btn-clear-holidays" disabled={!!busy} onClick={() => { if (window.confirm("Delete all stored trip opportunities?")) void mutate("clear_all_holidays", {}, "holidays"); }}><Icon name="fa-trash-can" /> Delete All</button></div>
          <div className="ai-preset-pills-bar" id="ai-preset-pills">{presets.map(([preset, label, icon]) => <button key={preset} type="button" className="ai-preset-pill" disabled={!!busy || !state.capabilities.ai} onClick={() => void mutate("generate_preset_holidays", { preset_type: preset }, "holidays", `preset-${preset}`)}><Icon name={icon} />{busy === `preset-${preset}` ? "Generating…" : label}</button>)}</div>{!state.capabilities.ai && <p className="native-admin-notice">Configure the existing WordPress AI API key to fetch presets.</p>}{status("holidays")}<Filters id="holiday-filters" options={holidayFilters} value={holidayFilter} onChange={setHolidayFilter} />
          <ul className="scrollable-list weekend-list" id="holiday-list">{holidays.map((holiday, index) => <li key={`${holiday.name}-${holiday.date}-${index}`} className="weekend-item"><div className="date-badge">{holiday.date}</div><div className="weekend-info"><h4>{holiday.name}</h4><p>{holiday.desc}</p></div></li>)}{!holidays.length && <li className="empty-state is-visible">No holidays found for this filter.</li>}</ul>
        </section>
        <section className="widget-card"><h3><Icon name="fa-list-check" /> Shared Team Tasks</h3><Filters id="todo-filters" options={[["all", "All"], ["today", "Today"], ["upcoming", "Upcoming"], ["overdue", "Overdue"], ["completed", "Completed"]]} value={taskFilter} onChange={setTaskFilter} />
          <form className="todo-form" id="ajax-todo-form" onSubmit={async event => { event.preventDefault(); const text = taskText, date = taskDate; if (await mutate("add_todo", { todo_text: text, todo_date: date }, "tasks")) { setTaskText(value => value === text ? "" : value); setTaskDate(value => value === date ? "" : value); } }}><input type="text" aria-label="Task description" placeholder="Task description..." required maxLength={2000} value={taskText} onChange={event => setTaskText(event.target.value)} /><input type="date" aria-label="Task target date" required value={taskDate} onChange={event => setTaskDate(event.target.value)} /><button type="submit" disabled={!!busy}><Icon name="fa-plus" />{busy === "add_todo" ? "Saving…" : "Add"}</button></form>{status("tasks")}
          <ul className="scrollable-list todo-list" id="todo-list">{tasks.map(task => <li key={task.id} className={`todo-item${task.status === "completed" ? " todo-completed" : taskTimeframe(task, state.today) === "overdue" ? " todo-overdue" : ""}`}><button type="button" className="todo-action-btn check" aria-label={`${task.status === "completed" ? "Mark pending" : "Mark as done"}: ${task.text}`} disabled={!!busy} onClick={() => void toggle(task)}><i aria-hidden="true" className={`${task.status === "completed" ? "fa-solid fa-circle-check" : "fa-regular fa-circle"} check-icon`} /></button><div className="todo-content"><p>{task.text}</p><span className="todo-meta"><i aria-hidden="true" className="fa-regular fa-calendar" /> Due: <strong>{task.target_date ? new Date(task.target_date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "No Date"}</strong> &nbsp;|&nbsp; <Icon name="fa-user-pen" /> {task.author}</span></div>{task.author_id === state.user.id && <button type="button" className="todo-action-btn delete" aria-label={`Delete task ${task.text}`} disabled={!!busy} onClick={() => { if (window.confirm("Delete this task?")) void mutate("delete_todo", { todo_id: task.id }, "tasks"); }}><Icon name="fa-trash-can" /></button>}</li>)}{!tasks.length && <li className="empty-state is-visible">No tasks match this filter.</li>}</ul>
        </section>
        <section className="widget-card"><h3><Icon name="fa-toolbox" /> Quick Tools</h3><h4 className="tp-tool-section-title"><Icon name="fa-magnifying-glass" /> Search & Send Itinerary</h4>
          <div className="custom-search-container tp-search-wrap" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}><input id="tour_search_input" type="text" aria-label="Search admin tours" placeholder="Search admin tours..." autoComplete="off" value={search} onFocus={() => setSearchOpen(true)} onChange={event => { setSearch(event.target.value); setTourId(0); setSearchOpen(true); }} onKeyDown={event => { if (event.key === "Escape") setSearchOpen(false); }} /><ul id="tour_search_results" style={{ display: searchOpen && search.trim() ? "block" : "none" }}>{matches.map(item => <li key={item.id} className="tour-option"><button type="button" onClick={() => { setTourId(item.id); setSearch(item.title); setSearchOpen(false); }}>{item.title}</button></li>)}{!matches.length && <li>No admin tours found.</li>}</ul></div>
          <button type="button" className="pdf-itinerary" id="directDownloadBtn" disabled={!tour} onClick={() => { if (tour) window.open(tour.pdf_url, "_blank", "noopener,noreferrer"); }}><Icon name="fa-file-pdf" /> Download PDF Itinerary</button>
          <form className="send-tour-email-box tp-email-box" onSubmit={event => { event.preventDefault(); if (tour) void mutate("send_tour_itinerary_email", { post_id: tour.id, customer_email: email, customer_phone: phone, departure_date: departure }, "email"); }}><h4>Send Itinerary to Customer</h4><input type="email" aria-label="Customer email" placeholder="Enter customer email *" required value={email} onChange={event => setEmail(event.target.value)} /><input type="tel" aria-label="Customer phone" placeholder="Enter customer phone (optional)" value={phone} onChange={event => setPhone(event.target.value)} /><input type="date" aria-label="Customer departure date" value={departure} onChange={event => setDeparture(event.target.value)} /><button type="submit" id="send_tour_email_btn" disabled={!!busy || !tour || !state.capabilities.email}><Icon name="fa-paper-plane" /> {busy === "send_tour_itinerary_email" ? "Sending…" : "Send Email"}</button>{!state.capabilities.email && <p className="native-admin-notice">Activate the Tripanza itinerary email module.</p>}{status("email")}</form>
        </section>
      </div>
    </main>
  </div>;
}
