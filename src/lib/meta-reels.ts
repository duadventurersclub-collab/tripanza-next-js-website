export type MetaReel = {
  id: number;
  video: string;
  tourId: number;
  tourSlug: string;
  title: string;
  cover: string;
  duration: string;
  address: string;
  rating: number;
  reviews: number;
  company: string;
  logo: string;
  price: number;
  oldPrice: number;
  currency: string;
};

type RawMetaReel = {
  id?: unknown;
  video?: unknown;
  tour_id?: unknown;
  tour_slug?: unknown;
  title?: unknown;
  cover?: unknown;
  duration?: unknown;
  address?: unknown;
  rating?: unknown;
  reviews?: unknown;
  company?: unknown;
  logo?: unknown;
  price?: unknown;
  old_price?: unknown;
  currency?: unknown;
};

const WORDPRESS_URL = (
  process.env.WORDPRESS_URL ||
  process.env.NEXT_PUBLIC_WORDPRESS_URL ||
  "https://tripanza.com"
).replace(/\/$/, "");

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

export async function getMetaReels(): Promise<MetaReel[]> {
  try {
    const response = await fetch(`${WORDPRESS_URL}/wp-json/tripanza-headless/v1/meta-reels?per_page=100`, {
      next: { revalidate: 300, tags: ["meta-reels"] },
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    const payload = await response.json() as { items?: RawMetaReel[] } | RawMetaReel[];
    const items = Array.isArray(payload) ? payload : payload.items;
    if (!Array.isArray(items)) return [];

    return items.map((item) => ({
      id: number(item.id),
      video: text(item.video),
      tourId: number(item.tour_id),
      tourSlug: text(item.tour_slug),
      title: text(item.title) || "Tripanza group trip",
      cover: text(item.cover),
      duration: text(item.duration),
      address: text(item.address),
      rating: Math.max(0, Math.min(5, number(item.rating))),
      reviews: Math.max(0, number(item.reviews)),
      company: text(item.company) || "Tripanza",
      logo: text(item.logo),
      price: Math.max(0, number(item.price)),
      oldPrice: Math.max(0, number(item.old_price)),
      currency: text(item.currency) || "INR",
    })).filter((item) => item.id > 0 && item.video && item.tourSlug);
  } catch {
    return [];
  }
}
