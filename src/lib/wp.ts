export type SiteConfig = {
  name: string;
  description: string;
  url: string;
  admin_url: string;
  site_language: string;
  timezone: string;
};

export type TourSummary = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  featured_image: string | null;
  price: string;
  currency: string;
  link: string;
};

export type TourDetail = TourSummary & {
  content: string;
  details: {
    origin: string;
    destination: string;
    duration: { days: string; nights: string };
    capacity: number;
    video_url: string;
    gallery: { url: string; alt: string }[];
    reels: string[];
    rating: { value: number; count: number };
    pricing: { currency: string; quad: { amount: number; display: string } | null; triple: { amount: number; display: string } | null; twin: { amount: number; display: string } | null; as_of: string };
    departures: { date: string; check_out: string; status: string; promoted: boolean; badge: string | null; benefit: string | null }[];
    itinerary: { day: number; title: string; description: string; image_url: string }[];
    stays: { title: string; description: string; location: string; type: string; amenities: string[]; images: string[] }[];
    highlights: string[];
    included: string[];
    excluded: string[];
    faqs: { question: string; answer: string }[];
    partner: { name: string; logo_url: string; instagram_url: string; verified: boolean; rating: number; trip_count: number };
  };
};

const WORDPRESS_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL || "http://localhost:10005";

export async function wpFetch<T>(path: string, revalidate = 300): Promise<T> {
  const res = await fetch(`${WORDPRESS_URL}/${path}`, {
    next: { revalidate },
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`WordPress request failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function getSiteConfig() {
  return wpFetch<SiteConfig>("wp-json/tripanza-headless/v1/site", 3600);
}

export async function getFeaturedTours(perPage = 6) {
  return wpFetch<{ items: TourSummary[]; total: number }>(`wp-json/tripanza-headless/v1/tours?per_page=${perPage}`, 300);
}

export async function getTourBySlug(slug: string) {
  return wpFetch<TourDetail>(`wp-json/tripanza-headless/v1/tours/${slug}`, 0);
}
