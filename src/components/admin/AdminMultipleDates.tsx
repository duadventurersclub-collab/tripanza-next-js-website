"use client";
import { useEffect, useRef, useState } from "react";
import { ADMIN_MONTHS } from "@/lib/admin-dashboard-types";

export default function AdminMultipleDates({ dates, onChange, today }: { dates: string[]; onChange: (dates: string[]) => void; today: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => new Date(`${today.slice(0, 7)}-01T00:00:00Z`));
  const [yearText, setYearText] = useState(today.slice(0, 4));
  const root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); input.current?.focus(); } };
    document.addEventListener("mousedown", click); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);
  const year = view.getUTCFullYear(), month = view.getUTCMonth();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const move = (offset: number) => { const next = new Date(Date.UTC(year, month + offset, 1)); setView(next); setYearText(String(next.getUTCFullYear())); };
  return <div ref={root} className="native-date-field">
    <input ref={input} id="trip_dates_picker" type="text" role="combobox" aria-autocomplete="none" aria-haspopup="dialog" aria-label="Trip departure dates" placeholder="Select dates (click multiple)..." value={dates.join(", ")} readOnly aria-expanded={open} aria-controls="admin-multiple-dates" onClick={() => setOpen(!open)} onKeyDown={event => { if (["Enter", " ", "ArrowDown"].includes(event.key)) { event.preventDefault(); setOpen(true); } }} />
    {open && <div id="admin-multiple-dates" className="native-date-calendar" role="dialog" aria-label="Select multiple departure dates">
      <div className="native-date-month"><button type="button" aria-label="Previous month" disabled={year === 1900 && month === 0} onClick={() => move(-1)}>‹</button><select aria-label="Departure calendar month" value={month} onChange={event => setView(new Date(Date.UTC(year, Number(event.target.value), 1)))}>{ADMIN_MONTHS.map((name, index) => <option key={name} value={index}>{name}</option>)}</select><input type="number" aria-label="Departure calendar year" min="1900" max="9999" value={yearText} onChange={event => { const text = event.target.value, value = Number(text); setYearText(text); if (value >= 1900 && value <= 9999) setView(new Date(Date.UTC(value, month, 1))); }} onBlur={() => setYearText(String(year))} /><button type="button" aria-label="Next month" disabled={year === 9999 && month === 11} onClick={() => move(1)}>›</button></div>
      <div className="native-date-grid">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span key={day}>{day}</span>)}
        {Array.from({ length: view.getUTCDay() }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: count }, (_, index) => {
          const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
          const selected = dates.includes(date);
          return <button key={date} type="button" aria-label={date} aria-pressed={selected} className={selected ? "is-selected" : date === today ? "is-today" : ""} disabled={!selected && dates.length >= 50} onClick={() => onChange(selected ? dates.filter(item => item !== date) : [...dates, date].sort())}>{index + 1}</button>;
        })}
      </div><div className="native-date-footer"><button type="button" onClick={() => onChange([])}>Clear</button><span>{dates.length} selected</span><button type="button" onClick={() => { setOpen(false); input.current?.focus(); }}>Done</button></div>
    </div>}
  </div>;
}
