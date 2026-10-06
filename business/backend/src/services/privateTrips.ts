import { db, schema } from "../db/index.js";

export interface PrivateTripSettings {
  sheets: { name: string; url: string; tab: string; category: "hotels" | "transport" | "activities" | "itineraries" | "other" }[];
  vendors: { name: string; url: string; notes: string }[];
  sourcePolicy: "sheets_only" | "sheets_and_vendors" | "vendors_only";
  markup: { type: "percentage" | "fixed"; value: number | null };
}
const defaults: PrivateTripSettings = { sheets: [], vendors: [], sourcePolicy: "sheets_only", markup: { type: "percentage", value: null } };
export class PrivateTripSettingsError extends Error {}
function fail(message: string): never { throw new PrivateTripSettingsError(message); }
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) fail("Invalid private-trip settings.");
  return value as Record<string, unknown>;
}
function string(value: unknown, max: number, label: string, required = false): string {
  if (typeof value !== "string" || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(`${label} is invalid or too long.`);
  const result = value.trim();
  if (required && !result) fail(`${label} is required.`);
  return result;
}
function httpsUrl(value: unknown, label: string): URL {
  const raw = string(value, 2048, label, true);
  let url: URL;
  try { url = new URL(raw); } catch { return fail(`${label} must be a full HTTPS URL.`); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search) fail(`${label} must be an HTTPS URL without credentials or query parameters.`);
  return url;
}
export function validatePrivateTripSettings(input: unknown): PrivateTripSettings {
  const data = object(input, ["sheets", "vendors", "sourcePolicy", "markup"]);
  if (!Array.isArray(data.sheets) || data.sheets.length > 30 || !Array.isArray(data.vendors) || data.vendors.length > 30) fail("Add up to 30 sheets and 30 vendors.");
  if (!["sheets_only", "sheets_and_vendors", "vendors_only"].includes(data.sourcePolicy as string)) fail("Choose a valid pricing source.");
  const sheets = data.sheets.map((entry: unknown) => {
    const row = object(entry, ["name", "url", "tab", "category"]);
    const name = string(row.name, 100, "Sheet name", true);
    // Strip Google's sharing parameters; store workbook identity, never access tokens.
    const raw = string(row.url, 2048, "Sheet link", true);
    let url: URL; try { url = new URL(raw); } catch { return fail("Use a Google Sheets link from docs.google.com/spreadsheets/d/…"); }
    const match = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/(?:edit|view|preview))?\/?$/);
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.port || url.username || url.password || !match) fail("Use a Google Sheets link from docs.google.com/spreadsheets/d/…");
    if (!["hotels", "transport", "activities", "itineraries", "other"].includes(row.category as string)) fail("Choose a valid sheet category.");
    return { name, url: `https://docs.google.com/spreadsheets/d/${match[1]}/edit`, tab: string(row.tab, 100, "Worksheet tab"), category: row.category as PrivateTripSettings["sheets"][number]["category"] };
  });
  if (new Set(sheets.map(s => `${s.url}\n${s.tab}`)).size !== sheets.length) fail("Each workbook and worksheet combination should be listed only once.");
  const vendors = data.vendors.map((entry: unknown) => {
    const row = object(entry, ["name", "url", "notes"]);
    const url = httpsUrl(row.url, "Vendor website");
    if (url.hostname === "localhost" || !url.hostname.includes(".") || /^[\d.]+$/.test(url.hostname) || url.hostname.startsWith("[") || /\.(?:local|localhost|internal|test)$/.test(url.hostname)) fail("Enter a public vendor website.");
    url.hash = "";
    return { name: string(row.name, 100, "Vendor name", true), url: url.href, notes: string(row.notes, 1000, "Vendor notes") };
  });
  if (new Set(vendors.map(v => v.url)).size !== vendors.length) fail("Each vendor website should be listed only once.");
  const markup = object(data.markup, ["type", "value"]);
  if (!["percentage", "fixed"].includes(markup.type as string)) fail("Choose percentage or fixed markup.");
  if (markup.value !== null && (typeof markup.value !== "number" || !Number.isFinite(markup.value) || markup.value < 0 || markup.value > (markup.type === "percentage" ? 100 : 10000000) || Math.abs(markup.value * 100 - Math.round(markup.value * 100)) > 1e-7)) fail("Markup must be a non-negative amount with at most two decimal places (percentage up to 100%).");
  return { sheets, vendors, sourcePolicy: data.sourcePolicy as PrivateTripSettings["sourcePolicy"], markup: { type: markup.type as PrivateTripSettings["markup"]["type"], value: markup.value as number | null } };
}
export async function privateTripStatus() {
  const [row] = await db.select().from(schema.privateTripSettings).limit(1);
  const settings = row ? validatePrivateTripSettings(JSON.parse(row.config_json)) : defaults;
  return { settings, updatedAt: row?.updated_at || null, quotingEnabled: false, status: "setup_pending", message: "Settings are saved for setup. Sheet access, rate mapping, and live vendor connections must be configured before automatic quotes can start." };
}
export async function savePrivateTripSettings(input: unknown) {
  const settings = validatePrivateTripSettings(input);
  await db.insert(schema.privateTripSettings).values({ id: "default", config_json: JSON.stringify(settings), updated_at: new Date().toISOString() }).onConflictDoUpdate({ target: schema.privateTripSettings.id, set: { config_json: JSON.stringify(settings), updated_at: new Date().toISOString() } });
  return privateTripStatus();
}
