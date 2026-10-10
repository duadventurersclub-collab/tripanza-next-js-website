export type TourSeoRule = {
  title: string;
  description: string;
  image_url: string;
  noindex: boolean;
};

export type TourRedirect = { from: string; to: string };
export type TourSeoConfig = { tours: Record<string, TourSeoRule>; redirects: TourRedirect[] };
export type AdminTourSeoConfig = TourSeoConfig & { revision: string };

export const EMPTY_TOUR_SEO: TourSeoConfig = { tours: {}, redirects: [] };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeTourSeo(value: unknown): TourSeoConfig {
  const input = record(value);
  const tours: TourSeoConfig["tours"] = {};
  for (const [id, raw] of Object.entries(record(input.tours)).slice(0, 1000)) {
    if (!/^[1-9][0-9]*$/.test(id)) continue;
    const rule = record(raw);
    const image = typeof rule.image_url === "string" ? rule.image_url : "";
    let imageUrl = "";
    if (image) {
      try { if (new URL(image).protocol === "https:") imageUrl = image; } catch { /* Ignore invalid image URLs. */ }
    }
    tours[id] = {
      title: typeof rule.title === "string" ? rule.title.slice(0, 140) : "",
      description: typeof rule.description === "string" ? rule.description.slice(0, 500) : "",
      image_url: imageUrl,
      noindex: rule.noindex === true,
    };
  }
  const redirects: TourRedirect[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(input.redirects) ? input.redirects.slice(0, 300) : []) {
    const entry = record(raw);
    if (typeof entry.from !== "string" || typeof entry.to !== "string") continue;
    if (!slugPattern.test(entry.from) || !slugPattern.test(entry.to) || entry.from === entry.to || seen.has(entry.from)) continue;
    seen.add(entry.from);
    redirects.push({ from: entry.from, to: entry.to });
  }
  return { tours, redirects };
}

export function redirectedTourSlug(config: TourSeoConfig, slug: string): string | null {
  return config.redirects.find(item => item.from === slug)?.to || null;
}
