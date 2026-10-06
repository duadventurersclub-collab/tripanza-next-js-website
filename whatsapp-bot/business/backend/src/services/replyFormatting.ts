import type { SiteFact } from "./website.js";

// WhatsApp uses single asterisks for bold; Markdown headings do not render there.
export function formatWhatsAppReply(reply: string): string {
  return reply.replace(/\r\n?/g, "\n")
    .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
    .replace(/^#{1,6}[ \t]+(.+)$/gm, (_, title: string) => `*${title.replace(/^\*|\*$/g, "").trim()}*`)
    .replace(/^[ \t]*[•●*][ \t]+/gm, "- ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export function hasDetailedReplyLayout(reply: string): boolean {
  return /^\*[^*\n]+\*:?$/m.test(reply) && /^-\s+\S/m.test(reply);
}

function heading(value: string): string {
  return `*${value.replace(/[\r\n*]/g, " ").trim()}*`;
}
function point(value: string): string {
  const line = value.trim().replace(/^[-•●]\s+/, "");
  if (/^Day \d+\b/i.test(line)) return `- *${line}*`;
  const label = line.match(/^([^:*\n]{1,55}):\s+(.+)$/);
  return label ? `- *${label[1]}:* ${label[2]}` : `- ${line}`;
}

// Preserve the verified text and caveats; only add presentation, never new facts.
export function formatVerifiedFacts(title: string, slug: string, facts: SiteFact[], titles: Map<string, { title: string }>): string {
  const groups = new Map<string, { title: string; lines: string[] }>();
  for (const fact of facts) {
    const key = fact.id.slice(fact.slug.length + 1);
    const section = key.startsWith("price-") ? "Price" : key.startsWith("departure-") ? "Departures" : key.startsWith("day-") ? "Itinerary" : key.startsWith("stay-") ? "Accommodation" : key.startsWith("faq-") ? "Questions" : ({ overview: "Trip details", included: "Included", excluded: "Extra costs", highlights: "Highlights" } as Record<string, string>)[key] || "Details";
    const groupKey = `${fact.slug}:${section}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { title: fact.slug === slug ? section : `${titles.get(fact.slug)?.title || fact.slug} — ${section}`, lines: [] });
    const lines = fact.text.split("\n").map(line => line.trim()).filter(Boolean);
    // These labels are already represented by their section heading.
    if (["Included:", "Excluded / additional charges:"].includes(lines[0])) lines.shift();
    groups.get(groupKey)!.lines.push(...lines.map(point));
  }
  return [heading(title), ...[...groups.values()].map(group => `${heading(group.title)}\n${group.lines.join("\n")}`)].join("\n\n");
}
