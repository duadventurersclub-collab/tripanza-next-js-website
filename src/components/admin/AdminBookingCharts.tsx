"use client";
import { useEffect, useRef, useState } from "react";
import type { Chart } from "chart.js";
import { bookingAnalytics, type AdminBooking } from "@/lib/admin-bookings-types";
export default function AdminBookingCharts({ rows, year }: { rows: AdminBooking[]; year: number }) {
  const revenue = useRef<HTMLCanvasElement>(null), gender = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true; let charts: Chart[] = [];
    import("chart.js/auto").then(({ default: Chart }) => {
      if (!alive || !revenue.current || !gender.current) return;
      const metrics = bookingAnalytics(rows, year, "all", "all"), mobile = window.matchMedia("(max-width:900px)").matches;
      const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const options = { responsive: true, maintainAspectRatio: false, animation: false as const, plugins: { legend: { position: mobile ? "bottom" as const : "top" as const, labels: { boxWidth: 12, color: "#64748b", font: { family: "Inter", size: mobile ? 10 : 12 } } } }, scales: { y: { beginAtZero: true, grid: { color: "#f1f5f9" }, ticks: { precision: 0, color: "#94a3b8", maxTicksLimit: mobile ? 5 : 8 } }, x: { grid: { display: false }, ticks: { maxTicksLimit: mobile ? 6 : 12, color: "#0f172a" } } } };
      charts = [new Chart(revenue.current, { type: "line", data: { labels, datasets: [{ label: String(year), data: metrics.current, borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,.1)", borderWidth: 2.5, tension: .35, fill: true, pointRadius: 3 }, { label: String(year - 1), data: metrics.previous, borderColor: "#0f172a", borderDash: [5, 5], borderWidth: 2, tension: .35, pointRadius: 3 }] }, options }), new Chart(gender.current, { type: "bar", data: { labels, datasets: metrics.genders.map((data, index) => ({ label: `${index % 2 ? "Female" : "Male"} ${index > 1 ? year - 1 : year}`, data, backgroundColor: ["rgba(37,99,235,.88)", "rgba(219,39,119,.88)", "rgba(37,99,235,.28)", "rgba(219,39,119,.28)"][index], borderRadius: 4, maxBarThickness: 18 })) }, options })];
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; charts.forEach(chart => chart.destroy()); };
  }, [rows, year]);
  return <div className="tz-chart-stack">{error && <p role="status">Charts could not load. The booking table and totals remain available.</p>}<div className="tz-chart-block"><div className="tz-chart-block__title"><h4>Revenue trend</h4><small>Monthly total column sum</small></div><div className="tz-chart-canvas-wrap"><canvas ref={revenue} role="img" aria-label={`Confirmed monthly revenue for ${year} and ${year - 1}`} /></div></div><div className="tz-chart-block"><div className="tz-chart-block__title"><h4>Male vs Female</h4><small>Guest count comparison · last 2 years</small></div><div className="tz-chart-canvas-wrap"><canvas ref={gender} role="img" aria-label={`Male and female traveller counts for ${year} and ${year - 1}`} /></div></div></div>;
}
