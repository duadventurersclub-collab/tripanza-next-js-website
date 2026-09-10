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
  return wpFetch<any>(`wp-json/tripanza-headless/v1/tours/${slug}`, 300);
}
