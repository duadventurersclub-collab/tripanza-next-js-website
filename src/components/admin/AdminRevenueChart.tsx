"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ADMIN_MONTHS, rupees } from "@/lib/admin-dashboard-types";

export default function AdminRevenueChart({ current, previous, year }: { current: number[]; previous: number[]; year: number }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [showCurrent, setShowCurrent] = useState(true), [showPrevious, setShowPrevious] = useState(true);
  const [width, setWidth] = useState(950);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(entries => { if (entries[0].contentRect.width) setWidth(Math.max(200, entries[0].contentRect.width)); });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const max = Math.max(1, ...(showCurrent ? current : []), ...(showPrevious ? previous : []));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const ceiling = Math.ceil(max / step) * step;
  const spacing = (width - 78) / 11;
  const x = (index: number) => 58 + index * spacing;
  const y = (value: number) => 242 - (value / ceiling) * 186;
  // Cubic curves reproduce the original line chart's rounded .3 tension.
  const path = (values: number[]) => values.map((value, index) => index === 0 ? `M ${x(0)} ${y(value)}` : `C ${x(index - 1) + spacing * .3} ${y(values[index - 1])}, ${x(index) - spacing * .3} ${y(value)}, ${x(index)} ${y(value)}`).join(" ");
  return <div ref={root} className="native-revenue-chart">
    <div className="native-chart-legend"><button type="button" aria-pressed={showCurrent} aria-label={`Show year ${year} revenue`} onClick={() => setShowCurrent(!showCurrent)}><b style={{ background: "#2563eb" }} />Year {year}</button><button type="button" aria-pressed={showPrevious} aria-label={`Show year ${year - 1} revenue`} onClick={() => setShowPrevious(!showPrevious)}><b style={{ background: "#10CD78" }} />Year {year - 1}</button></div>
    <svg viewBox={`0 0 ${width} 280`} role="group" aria-label={`Monthly confirmed revenue in ${year} and ${year - 1}`}>
      <defs><linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity=".12" /><stop offset="1" stopColor="#2563eb" stopOpacity=".03" /></linearGradient></defs>
      {Array.from({ length: 5 }, (_, index) => {
        const value = ceiling * index / 4;
        return <g key={index}><line x1="58" x2={width - 20} y1={y(value)} y2={y(value)} stroke="#f4f7fe" /><text x="46" y={y(value) + 4} textAnchor="end" fill="#a3aed0" fontSize="12">₹{value >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : Number(value.toFixed(1))}</text></g>;
      })}
      {showCurrent && <><path d={`${path(current)} L ${x(11)} 242 L ${x(0)} 242 Z`} fill={`url(#fill-${id})`} /><path d={path(current)} stroke="#2563eb" strokeWidth="3" fill="none" /></>}
      {showPrevious && <path d={path(previous)} stroke="#10CD78" strokeWidth="2" strokeDasharray="5 5" fill="none" />}
      {ADMIN_MONTHS.map((month, index) => <g key={month}>
        {(width >= 600 || index % (width < 320 ? 3 : 2) === 0) && <text x={x(index)} y="270" textAnchor="middle" fill="#2b3674" fontSize="12" fontWeight="600">{month.slice(0, 3)}</text>}
        {showPrevious && <circle cx={x(index)} cy={y(previous[index])} r="3" fill="#10CD78" />}
        {showCurrent && <circle cx={x(index)} cy={y(current[index])} r="4" fill="#2563eb" />}
        <rect x={x(index) - spacing / 2} y="38" width={spacing} height="208" fill="transparent" tabIndex={0} role="button" aria-label={`${month}: ${year} ${rupees(current[index])}, ${year - 1} ${rupees(previous[index])}`} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(index)} onBlur={() => setHover(null)} onClick={() => setHover(index)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setHover(index); } }} />
      </g>)}
    </svg>
    {hover !== null && (showCurrent || showPrevious) && <div className="native-chart-tooltip" role="status"><strong>{ADMIN_MONTHS[hover]}</strong>{showCurrent && <span>Year {year}: {rupees(current[hover])}</span>}{showPrevious && <span>Year {year - 1}: {rupees(previous[hover])}</span>}</div>}
  </div>;
}
