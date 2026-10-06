import { load } from "cheerio";
import { eq, and, notInArray, inArray } from "drizzle-orm";
import { config } from "../config.js";
import { db, schema } from "../db/index.js";
import { logger } from "../utils/logger.js";
import { aiProviderStatus } from "./aiSettings.js";

export interface SiteFact { id: string; text: string; slug: string; url: string }
export interface SiteAsset { kind: "image" | "video" | "document"; url: string; caption: string; fileName: string }
export interface Tour {
  slug: string; title: string; url: string; destination: string; origin: string;
  duration: string; fetchedAt: string; facts: SiteFact[];
  accommodation: SiteAsset[]; photos: SiteAsset[]; videos: SiteAsset[]; pdf: SiteAsset;
}
const API = "/wp-json/tripanza-headless/v1/tours";
const base = new URL(config.website.url);
if (base.username || base.password || (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname))) {
  throw new Error("WEBSITE_URL must be a public HTTPS website origin.");
}
base.pathname = "/"; base.search = ""; base.hash = "";
export const websiteOrigin = base.origin;
const tourPath = /^\/(?:tour|tours|itinerary|itineraries|accommodation|accommodations)\/[a-z0-9-]+\/?$/i;

export function siteUrl(value: unknown, purpose: "page" | "api" | "media" | "pdf"): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    if (url.origin !== base.origin || url.username || url.password || /%2f|%5c/i.test(url.pathname)) return null;
    url.hash = "";
    if (purpose === "api" && !new RegExp(`^${API}(?:/[a-z0-9-]+)?/?$`).test(url.pathname)) return null;
    if (purpose === "page" && (!tourPath.test(url.pathname) || url.search)) return null;
    if (purpose === "media" && (!url.pathname.startsWith("/wp-content/uploads/") || !/\.(?:pdf|jpe?g|png|webp|avif|gif|mp4|webm)$/i.test(url.pathname) || url.search)) return null;
    if (purpose === "pdf" && (!tourPath.test(url.pathname) || url.searchParams.get("generate_pdf") !== "1" || [...url.searchParams.keys()].some(k => !["generate_pdf", "pdf_ready"].includes(k)))) return null;
    return url.href;
  } catch { return null; }
}

export async function fetchSite(value: string, purpose: "api" | "media" | "pdf", maxBytes = 2 * 1024 * 1024) {
  let url = siteUrl(value, purpose);
  if (!url) throw new Error("URL is outside the approved website scope");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), purpose === "api" ? 20000 : 60000);
  try {
    for (let redirect = 0; redirect < 4; redirect++) {
      const response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { "User-Agent": "Tripanza-Workspace/1.0", "Accept": purpose === "api" ? "application/json" : "*/*" } });
      if (response.status >= 300 && response.status < 400) {
        const target = siteUrl(new URL(response.headers.get("location") || "", url).href, purpose);
        await response.body?.cancel();
        if (!target) throw new Error("Website redirected outside approved scope");
        url = target; continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Website returned HTTP ${response.status}`); }
      const mime = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const allowed = purpose === "api" ? /^(?:application\/json|application\/[^;]+\+json)$/.test(mime)
        : purpose === "pdf" ? mime === "application/pdf" : /^(?:image\/(?:jpeg|png|webp|avif|gif)|video\/(?:mp4|webm)|application\/pdf)$/.test(mime);
      if (!allowed || Number(response.headers.get("content-length") || 0) > maxBytes) {
        await response.body?.cancel(); throw new Error("Website file has an unsupported type or exceeds the size limit");
      }
      const parts: Buffer[] = []; let size = 0;
      for await (const chunk of response.body!) {
        size += chunk.length;
        if (size > maxBytes) { controller.abort(); throw new Error("Website file exceeds the size limit"); }
        parts.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(parts);
      if (mime === "application/pdf" && !buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Website did not return a PDF document");
      return { buffer, mime, url };
    }
    throw new Error("Too many website redirects");
  } finally { clearTimeout(timeout); }
}

function text(value: unknown, limit = 2200): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const $ = load(String(value)); $("script,style,iframe,form").remove();
  $("li,p,br,h1,h2,h3,h4,div,tr").each((_i, el) => { $(el).append("\n"); });
  return $.root().text().replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim().slice(0, limit);
}
function list(value: unknown): any[] { return Array.isArray(value) ? value.slice(0, 100) : []; }
function catalogue(raw: any) {
  const slug = typeof raw?.slug === "string" ? raw.slug : "";
  const url = siteUrl(raw?.link, "page");
  if (!/^[a-z0-9-]{1,180}$/.test(slug) || !url || new URL(url).pathname.split("/").filter(Boolean).at(-1) !== slug || (raw.status && raw.status !== "publish")) return null;
  const d = raw.details || {};
  return { slug, title: text(raw.title, 180), url, origin: text(d.origin, 100), destination: text(d.destination, 160), duration: text(d.duration?.days, 100) };
}
export function normalizeTour(raw: any): Tour {
  const c = catalogue(raw); if (!c?.title) throw new Error("Tour is unpublished or outside approved sections");
  const d = raw.details || {}; const facts: SiteFact[] = [];
  const fact = (key: string, value: unknown) => { const content = text(value); if (content) facts.push({ id: `${c.slug}:${key}`, text: content, slug: c.slug, url: c.url }); };
  fact("overview", `${c.title}\nDestination: ${c.destination || "Not listed"}\nPickup: ${c.origin || "Not listed"}\nDuration: ${c.duration || "Not listed"}`);
  const p = d.pricing || {};
  for (const sharing of ["quad", "triple", "twin"]) if (p[sharing]?.display) fact(`price-${sharing}`, `${sharing[0].toUpperCase() + sharing.slice(1)} sharing: ${p[sharing].display}\nWebsite price checked: ${p.as_of || new Date().toISOString()}\nRates and availability are subject to confirmation; a chat reply does not confirm a booking.`);
  // Never infer available seats from capacity, a review, or a tour-level price.
  for (const [i, departure] of list(d.departures).entries()) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(departure.date || "") && departure.date >= new Date().toISOString().slice(0, 10)) {
      fact(`departure-${i}`, `Departure: ${departure.date}${departure.check_out ? `; return: ${departure.check_out}` : ""}\nWebsite status: ${departure.status || "Not specified"}. Confirm with the team before booking.`);
    }
  }
  for (const [i, day] of list(d.itinerary).entries()) fact(`day-${i}`, `${day.title || `Day ${day.day || i + 1}`}\n${day.description || ""}`);
  fact("included", list(d.included).length ? `Included:\n${list(d.included).join("\n")}` : "");
  fact("excluded", list(d.excluded).length ? `Excluded / additional charges:\n${list(d.excluded).join("\n")}` : "");
  fact("highlights", list(d.highlights).join("\n"));
  for (const [i, faq] of list(d.faqs).entries()) fact(`faq-${i}`, `${faq.question || ""}\n${faq.answer || ""}`);
  const asset = (value: unknown, kind: SiteAsset["kind"], caption: string): SiteAsset | null => {
    const url = siteUrl(value, "media"); if (!url) return null;
    const ext = new URL(url).pathname.split(".").at(-1)?.toLowerCase();
    if (kind === "image" && !["jpg", "jpeg", "png", "webp", "avif", "gif"].includes(ext || "")) return null;
    if (kind === "video" && !["mp4", "webm"].includes(ext || "")) return null;
    return { url, kind, caption: text(caption, 850), fileName: new URL(url).pathname.split("/").at(-1)! };
  };
  const accommodation: SiteAsset[] = [];
  for (const [i, stay] of list(d.stays).entries()) {
    const caption = `${stay.title || "Accommodation"} — ${stay.location || c.destination}\n${stay.description || ""}`;
    fact(`stay-${i}`, `${caption}\nType: ${stay.type || "Not listed"}\nAmenities: ${list(stay.amenities).join(", ")}`);
    // Keep a balanced gallery: at most two images per stay, never mislabel tour photos as hotel photos.
    for (const image of list(stay.images).slice(0, 2)) { const a = asset(typeof image === "string" ? image : image?.url, "image", caption); if (a) accommodation.push(a); }
  }
  const photos = list(d.gallery).map(i => asset(typeof i === "string" ? i : i?.url, "image", c.title)).filter((a): a is SiteAsset => !!a).slice(0, 6);
  const videos = [...list(d.reels), d.video_url].map(i => asset(i, "video", c.title)).filter((a): a is SiteAsset => !!a).slice(0, 2);
  const pdfUrl = new URL(c.url); pdfUrl.searchParams.set("generate_pdf", "1"); pdfUrl.searchParams.set("pdf_ready", "1");
  return { ...c, fetchedAt: new Date().toISOString(), facts, accommodation: accommodation.slice(0, 6), photos, videos, pdf: { kind: "document", url: pdfUrl.href, caption: `${c.title} — official itinerary`, fileName: `${c.slug}-itinerary.pdf` } };
}

export class WebsiteSourceError extends Error {}
export function validateTourSources(urls: unknown) {
  if (!Array.isArray(urls) || urls.length > config.website.maxTours) throw new WebsiteSourceError(`Enter up to ${config.website.maxTours} tour links, one per line.`);
  const sources = new Map<string, { slug: string; url: string }>();
  for (const [index, value] of urls.entries()) {
    const error = () => new WebsiteSourceError(`Link ${index + 1} must be a full tour URL on ${base.origin}, without query parameters.`);
    if (typeof value !== "string" || value.length > 2048 || !/^https?:\/\//i.test(value.trim())) throw error();
    const approved = siteUrl(value.trim(), "page");
    if (!approved) throw error();
    const url = new URL(approved);
    const match = /^\/(?:tour|tours)\/([a-z0-9-]{1,180})\/?$/.exec(url.pathname);
    if (!match) throw error();
    url.pathname = `${url.pathname.replace(/\/$/, "")}/`;
    sources.set(match[1], { slug: match[1], url: url.href });
  }
  return [...sources.values()];
}

async function selection() {
  return db.transaction(async tx => {
    await tx.insert(schema.websiteSync).values({ id: "website" }).onConflictDoNothing();
    const state = (await tx.select().from(schema.websiteSync).where(eq(schema.websiteSync.id, "website")))[0];
    return { revision: state.selection_revision, sources: await tx.select().from(schema.websiteSources) };
  });
}

export async function saveWebsiteSources(urls: unknown) {
  const sources = validateTourSources(urls);
  const now = new Date().toISOString();
  await db.transaction(async tx => {
    const state = (await tx.select().from(schema.websiteSync).where(eq(schema.websiteSync.id, "website")))[0];
    await tx.delete(schema.websiteSources);
    for (const source of sources) await tx.insert(schema.websiteSources).values({ ...source, added_at: now });
    if (sources.length) await tx.delete(schema.websiteTours).where(notInArray(schema.websiteTours.slug, sources.map(source => source.slug)));
    else await tx.delete(schema.websiteTours);
    const update = { selection_revision: (state?.selection_revision || 0) + 1, last_success_at: null, error: null };
    await tx.insert(schema.websiteSync).values({ id: "website", ...update }).onConflictDoUpdate({ target: schema.websiteSync.id, set: update });
  });
}

export async function areToursAllowed(slugs: string[]) {
  if (!slugs.length) return true;
  if (!config.website.enabled) return false;
  const unique = [...new Set(slugs)];
  const rows = await db.select({ slug: schema.websiteSources.slug }).from(schema.websiteSources)
    .innerJoin(schema.websiteTours, eq(schema.websiteTours.slug, schema.websiteSources.slug))
    .where(inArray(schema.websiteSources.slug, unique));
  return rows.length === unique.length;
}

let syncing: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let stopping = false;
export async function syncWebsite() {
  if (!config.website.enabled) return;
  if (syncing) return syncing;
  syncing = (async () => {
    // A changed selection invalidates an in-flight index. Repeat using the new
    // list so a late website response cannot restore a removed tour.
    while (!stopping) {
      const snapshot = await selection();
      const now = new Date().toISOString();
      await db.update(schema.websiteSync).set({ last_attempt_at: now, error: null }).where(and(eq(schema.websiteSync.id, "website"), eq(schema.websiteSync.selection_revision, snapshot.revision)));
      const entries = new Map<string, NonNullable<ReturnType<typeof catalogue>>>();
      const errors = new Map<string, string>();
      for (const source of snapshot.sources) {
        if (stopping) return;
        if ((await selection()).revision !== snapshot.revision) break;
        try {
          const result = await fetchSite(`${base.origin}${API}/${source.slug}`, "api");
          const raw = JSON.parse(result.buffer.toString("utf8"));
          const c = catalogue(raw);
          if (!c?.title || c.slug !== source.slug) throw new Error("Tour is unpublished, missing, or outside the selected tour pages");
          validateTourSources([c.url]);
          entries.set(c.slug, c);
        } catch (error) {
          errors.set(source.slug, error instanceof Error ? error.message.slice(0, 250) : "Tour could not be indexed");
        }
      }
      if (stopping) return;
      const applied = await db.transaction(async tx => {
        const current = (await tx.select().from(schema.websiteSync).where(eq(schema.websiteSync.id, "website")))[0];
        if (current.selection_revision !== snapshot.revision) return false;
        for (const c of entries.values()) await tx.insert(schema.websiteTours).values({ slug: c.slug, title: c.title, url: c.url, catalogue_json: JSON.stringify(c), indexed_at: now }).onConflictDoUpdate({ target: schema.websiteTours.slug, set: { title: c.title, url: c.url, catalogue_json: JSON.stringify(c), indexed_at: now } });
        if (entries.size) await tx.delete(schema.websiteTours).where(notInArray(schema.websiteTours.slug, [...entries.keys()]));
        else await tx.delete(schema.websiteTours);
        for (const source of snapshot.sources) await tx.update(schema.websiteSources).set({ error: errors.get(source.slug) || null }).where(eq(schema.websiteSources.slug, source.slug));
        await tx.update(schema.websiteSync).set({ last_success_at: now, error: errors.size ? `${errors.size} selected tour link${errors.size === 1 ? "" : "s"} could not be indexed. Check the link list below.` : null }).where(eq(schema.websiteSync.id, "website"));
        return true;
      });
      if (applied) { logger.info(`[website] Indexed ${entries.size} manually selected tours from ${base.origin}`); return; }
    }
  })().finally(() => { syncing = null; });
  return syncing;
}
export async function websiteStatus() {
  const snapshot = await selection();
  const approved = new Set(snapshot.sources.map(source => source.slug));
  const rows = (await db.select().from(schema.websiteTours)).filter(row => approved.has(row.slug));
  const status = (await db.select().from(schema.websiteSync).limit(1))[0];
  const ai = await aiProviderStatus();
  return { enabled: config.website.enabled, website: base.origin, aiConfigured: ai.configured, model: config.ai.model, syncing: !!syncing, syncHours: config.website.syncHours, maxTours: config.website.maxTours, sourceMode: "manual", sources: snapshot.sources.map(source => ({ slug: source.slug, url: source.url, error: source.error, indexed: rows.some(row => row.slug === source.slug) })), scope: ["Selected tours", "Their itineraries", "Their accommodation"], lastSuccessAt: status?.last_success_at || null, error: status?.error || null, tours: rows.map(r => ({ slug: r.slug, title: r.title, url: r.url, detailFetchedAt: r.detail_fetched_at })) };
}
export async function selectedTourRoutes() {
  const approved = new Set((await selection()).sources.map(source => source.slug));
  return (await db.select().from(schema.websiteTours)).filter(row => approved.has(row.slug)).map(row => JSON.parse(row.catalogue_json) as { slug: string; title: string; destination: string; origin: string; url: string });
}
export async function searchTours(query: string) {
  const state = (await db.select().from(schema.websiteSync).limit(1))[0];
  if (!state?.last_success_at || Date.now() - Date.parse(state.last_success_at) > config.website.syncHours * 3600000) await syncWebsite();
  const approved = new Set((await selection()).sources.map(source => source.slug));
  const rows = (await db.select().from(schema.websiteTours)).filter(row => approved.has(row.slug));
  const generic = new Set(["tour", "tours", "trip", "trips", "available", "recommend", "show", "please", "have", "what", "which", "want", "travel", "looking", "from", "with", "the", "all", "holiday", "holidays"]);
  const words = (query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(w => !generic.has(w));
  return rows.map(row => {
    const c = JSON.parse(row.catalogue_json);
    const hay = `${c.title} ${c.destination} ${c.origin} ${c.slug}`.toLowerCase();
    return { ...c, score: words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0) };
  }).filter(c => !words.length || c.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 8).map(({ score: _score, ...c }) => c);
}
const fetching = new Map<string, Promise<Tour>>();
export async function getTour(slug: string): Promise<Tour> {
  if (!/^[a-z0-9-]{1,180}$/.test(slug)) throw new Error("Invalid tour identifier");
  if (!await areToursAllowed([slug])) throw new Error("This tour is not in the selected website links");
  if (fetching.has(slug)) return fetching.get(slug)!;
  const task = (async () => {
    const row = (await db.select().from(schema.websiteTours).where(eq(schema.websiteTours.slug, slug)).limit(1))[0];
    if (!row) throw new Error("This tour is not in the public website catalogue");
    // Read live details for every answer. Cached pricing and withdrawn departures are never silently reused.
    const result = await fetchSite(`${base.origin}${API}/${slug}`, "api");
    const raw = JSON.parse(result.buffer.toString("utf8"));
    if (raw.slug !== slug) throw new Error("Website returned a different tour");
    const tour = normalizeTour(raw);
    validateTourSources([tour.url]);
    if (!await areToursAllowed([slug])) throw new Error("This tour was removed from the selected website links");
    await db.update(schema.websiteTours).set({ detail_json: JSON.stringify(tour), detail_fetched_at: tour.fetchedAt }).where(eq(schema.websiteTours.slug, slug));
    return tour;
  })().finally(() => { fetching.delete(slug); });
  fetching.set(slug, task); return task;
}
export function startWebsiteSync() {
  if (!config.website.enabled) return;
  stopping = false;
  syncWebsite().catch(e => logger.warn("[website] Initial sync:", e.message));
  timer = setInterval(() => { syncWebsite().catch(e => logger.warn("[website] Sync:", e.message)); }, config.website.syncHours * 3600000); timer.unref();
}
export async function stopWebsiteSync() {
  stopping = true; if (timer) clearInterval(timer); timer = null;
  await syncing?.catch(() => undefined);
}
