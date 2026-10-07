export const HOMEPAGE_SECTIONS = {
  hero: "Homepage hero",
  departures: "Leaving soon",
  deals: "Deal drop",
  trips: "Explore trips",
  destinations: "Destinations",
  reels: "Trip reels",
  budget: "Trips under ₹10,000",
  quick: "Quick escapes",
  gallery: "Tripanza camera roll",
  stays: "Stays",
} as const;

export type HomepageSection = keyof typeof HOMEPAGE_SECTIONS;
export type HomepageSectionRule = {
  mode: "automatic" | "manual" | "category";
  slugs: string[];
  taxonomy: string;
  term: string;
};
export type HomepageSections = Record<HomepageSection, HomepageSectionRule>;
export type HomepageCatalog = {
  tours: Array<{ id: number; slug: string; title: string; terms: Record<string, Array<{ id: number; slug: string; name: string }>> }>;
  taxonomies: Array<{ slug: string; label: string; terms: Array<{ id: number; slug: string; name: string }> }>;
};

export function defaultHomepageSections(): HomepageSections {
  const sections = {} as HomepageSections;
  for (const key of Object.keys(HOMEPAGE_SECTIONS) as HomepageSection[]) {
    sections[key] = { mode: "automatic", slugs: [], taxonomy: "", term: "" };
  }
  return sections;
}

export function normalizeHomepageSections(value: unknown): HomepageSections {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const defaults = defaultHomepageSections();
  for (const key of Object.keys(HOMEPAGE_SECTIONS) as HomepageSection[]) {
    const rule = input[key] && typeof input[key] === "object" ? input[key] as Partial<HomepageSectionRule> : {};
    defaults[key] = {
      mode: rule.mode === "manual" || rule.mode === "category" ? rule.mode : "automatic",
      slugs: Array.isArray(rule.slugs) ? rule.slugs.filter((slug): slug is string => typeof slug === "string") : [],
      taxonomy: typeof rule.taxonomy === "string" ? rule.taxonomy : "",
      term: typeof rule.term === "string" ? rule.term : "",
    };
  }
  return defaults;
}
