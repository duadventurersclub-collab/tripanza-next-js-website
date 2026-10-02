"use client";

import { useEffect, useMemo, useState } from "react";
import type { HostProfile, HostTour } from "@/lib/host";
import "./poster-studio.css";

const styles = {
  tropical: { label: "Tropical Doodle", direction: "bold tropical doodles, playful stickers, vivid youth-travel energy", colors: ["#3157d5", "#d0e562"] },
  editorial: { label: "Minimal Travel", direction: "minimal editorial travel campaign, strong typography, generous whitespace", colors: ["#151925", "#f5f0e6"] },
  cinematic: { label: "Cinematic Gen-Z", direction: "cinematic destination photography, deep contrast, premium Gen-Z campaign", colors: ["#101a3c", "#ff667d"] },
  polaroid: { label: "Polaroid / Film", direction: "35mm film, taped polaroids, candid friends, warm grain", colors: ["#7d4a38", "#f4d99b"] },
  popart: { label: "Pop Art / Comic", direction: "high-energy comic poster, halftone texture, bold outlined type", colors: ["#e42c68", "#ffe34f"] },
  adventure: { label: "Rugged Adventure", direction: "rugged outdoor expedition, topo lines, stamped labels, earthy contrast", colors: ["#173f34", "#e8a64c"] },
} as const;

type StyleKey = keyof typeof styles;

function tripDate(trip: HostTour) {
  const date = trip.selected_dates?.filter(Boolean).sort()[0];
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Dates on request";
}

function promptFor(trip: HostTour, profile: HostProfile, style: StyleKey, pov: string) {
  return `Create a high-converting Instagram Story travel poster in 9:16 format.

TRIP DETAILS
- Trip: ${trip.title}
- Destination: ${trip.address || "India"}
- Duration: ${trip.duration || "Group trip"}
- Departure: ${tripDate(trip)}
- Price: ${trip.price ? `₹${trip.price.toLocaleString("en-IN")} per person` : "Price on request"}
- Hosted by: ${profile.name}
- Contact: ${profile.phone || "DM the host"}

CREATIVE DIRECTION
- ${styles[style].direction}
- Use destination-specific scenery and culture; never make it look like a generic travel poster
- Clear visual hierarchy, mobile-readable typography, strong booking intent
- Hook: "${pov}"
- Include: trip title, date, duration, price, host name and contact CTA
- Footer: "Powered by Tripanza"

Do not invent inclusions, discounts, availability or landmarks that are not supplied above.`;
}

function coverImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function wrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 4) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  return y + Math.min(lines.length, maxLines) * lineHeight;
}

export default function HostPosterStudio({ profile }: { profile: HostProfile }) {
  const [search, setSearch] = useState("");
  const [pov, setPov] = useState("POV: I’m hosting a trip 🚀");
  const [choices, setChoices] = useState<Record<number, StyleKey>>({});
  const [notice, setNotice] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem("tripanza_host_poster_pov");
      if (saved) setPov(saved);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const trips = useMemo(() => profile.trips.filter(trip => trip.title.toLowerCase().includes(search.trim().toLowerCase())), [profile.trips, search]);

  function savePov() {
    window.localStorage.setItem("tripanza_host_poster_pov", pov.trim());
    setNotice("Default poster hook saved.");
    window.setTimeout(() => setNotice(""), 1800);
  }

  async function copy(trip: HostTour) {
    await navigator.clipboard.writeText(promptFor(trip, profile, choices[trip.id] || "tropical", pov));
    setNotice(`Prompt copied for ${trip.title}.`);
    window.setTimeout(() => setNotice(""), 1800);
  }

  function openGenerator(trip: HostTour) {
    const prompt = promptFor(trip, profile, choices[trip.id] || "tropical", pov);
    window.open(`https://chat.openai.com/?q=${encodeURIComponent(prompt)}`, "_blank", "noopener,noreferrer");
  }

  async function download(trip: HostTour) {
    setDownloading(trip.id);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Poster canvas is unavailable.");
      const theme = styles[choices[trip.id] || "tropical"];
      const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
      gradient.addColorStop(0, theme.colors[0]); gradient.addColorStop(1, theme.colors[1]);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1920);
      if (trip.image) {
        try { const image = await loadImage(trip.image); ctx.save(); ctx.globalAlpha = .58; coverImage(ctx, image, 1080, 1920); ctx.restore(); } catch { /* Gradient remains a valid poster. */ }
      }
      const shade = ctx.createLinearGradient(0, 150, 0, 1920);
      shade.addColorStop(0, "rgba(7,10,20,.1)"); shade.addColorStop(.55, "rgba(7,10,20,.35)"); shade.addColorStop(1, "rgba(7,10,20,.94)");
      ctx.fillStyle = shade; ctx.fillRect(0, 0, 1080, 1920);
      ctx.fillStyle = "#d0e562"; ctx.fillRect(70, 76, 18, 18);
      ctx.fillStyle = "#fff"; ctx.font = "900 26px Arial"; ctx.fillText("TRIPANZA HOST DROP", 108, 94);
      ctx.font = "700 34px Arial"; ctx.fillStyle = "#d0e562"; ctx.fillText(pov.toUpperCase().slice(0, 54), 70, 1170);
      ctx.font = "900 92px Arial"; ctx.fillStyle = "#fff";
      let y = wrapped(ctx, trip.title.toUpperCase(), 70, 1285, 930, 100, 4);
      ctx.font = "700 34px Arial"; ctx.fillStyle = "#d0e562"; y += 28; ctx.fillText(`${tripDate(trip)}  •  ${trip.duration || "GROUP TRIP"}`, 70, y);
      y += 76; ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.roundRect(70, y, 940, 190, 30); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "700 27px Arial"; ctx.fillText("STARTING FROM", 105, y + 65);
      ctx.font = "900 60px Arial"; ctx.fillStyle = "#d0e562"; ctx.fillText(trip.price ? `₹${trip.price.toLocaleString("en-IN")}` : "ASK FOR PRICE", 105, y + 137);
      ctx.font = "700 27px Arial"; ctx.fillStyle = "#fff"; ctx.fillText(`HOSTED BY ${profile.name.toUpperCase()}`, 70, 1790);
      ctx.font = "500 23px Arial"; ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillText(profile.phone ? `WHATSAPP ${profile.phone}` : "DM TO JOIN THE CREW", 70, 1835);
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url; link.download = `${trip.slug || "tripanza-trip"}-poster.png`; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    } finally { setDownloading(null); }
  }

  return <div className="hps-page"><main className="hps-shell">
    <header className="hps-hero"><span>HOST DASHBOARD / POSTER STUDIO</span><h1>Make the drop.<br /><em>Fill the crew.</em></h1><p>Download a ready story poster or generate an AI creative prompt for any of your live trips.</p></header>
    <section className="hps-tools"><label><span>Find a trip</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search your trips…" /></label><label><span>Default POV hook</span><span className="hps-pov"><input value={pov} onChange={event => setPov(event.target.value)} maxLength={80} /><button type="button" onClick={savePov}>Save</button></span></label></section>
    {notice && <div className="hps-notice" role="status">{notice}</div>}
    {trips.length ? <section className="hps-grid">{trips.map(trip => <article className="hps-card" key={trip.id}>
      <div className="hps-cover" style={trip.image ? { backgroundImage: `linear-gradient(180deg,transparent,#101522e8),url(${trip.image})` } : undefined}><span>STORY 9:16</span><div><small>{tripDate(trip)}</small><h2>{trip.title}</h2><p>{trip.duration || "Group trip"} · {trip.price ? `₹${trip.price.toLocaleString("en-IN")}` : "Price on request"}</p></div></div>
      <div className="hps-body"><label>Poster style<select value={choices[trip.id] || "tropical"} onChange={event => setChoices(current => ({ ...current, [trip.id]: event.target.value as StyleKey }))}>{Object.entries(styles).map(([key, style]) => <option value={key} key={key}>{style.label}</option>)}</select></label><div className="hps-actions"><button type="button" className="primary" onClick={() => void download(trip)} disabled={downloading === trip.id}>{downloading === trip.id ? "Building…" : "Download PNG"}</button><button type="button" onClick={() => void copy(trip)}>Copy prompt</button><button type="button" onClick={() => openGenerator(trip)}>Open AI generator ↗</button></div><small className="hps-truth">Opening the AI generator sends only the written prompt. No traveller media is uploaded automatically.</small></div>
    </article>)}</section> : <div className="hps-empty"><h2>No matching live trips.</h2><p>Publish a trip first, then its poster tools will appear here.</p></div>}
  </main></div>;
}
