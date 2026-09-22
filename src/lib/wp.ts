export {
  getAppTourAvailability,
  getAppTours,
  getFeaturedTours,
  getTourById,
  getTourBySlug,
  plainText,
  transformStTour,
} from "./st-tours";

export type {
  TourAccommodation,
  TourAvailabilityBatch,
  TourDetail,
  TourFAQ,
  TourItineraryDay,
  TourPartner,
  TourPricingMatrix,
  TourSummary,
} from "./st-tours";

export type SiteConfig = {
  name: string;
  description: string;
  url: string;
  admin_url: string;
  site_language: string;
  timezone: string;
};

export interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface UserBooking {
  id: number;
  title: string;
  status: string;
  amount: string;
  created_at: string;
}

const WORDPRESS_URL = (
  process.env.WORDPRESS_URL ||
  process.env.NEXT_PUBLIC_WORDPRESS_URL ||
  "https://tripanza.com"
).replace(/\/$/, "");

export async function wpFetch<T>(path: string, revalidate = 300): Promise<T> {
  const url = `${WORDPRESS_URL}/${path.replace(/^\//, "")}`;
  const response = await fetch(url, {
    next: { revalidate },
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`WordPress request failed: ${response.status} ${response.statusText} at ${url}`);
  }

  return response.json() as Promise<T>;
}

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    return await wpFetch<SiteConfig>("wp-json/tripanza-headless/v1/site", 3600);
  } catch {
    return {
      name: "Tripanza",
      description: "India's coolest travel community",
      url: WORDPRESS_URL,
      admin_url: `${WORDPRESS_URL}/wp-admin`,
      site_language: "en-IN",
      timezone: "Asia/Kolkata",
    };
  }
}

export async function getUserProfile(sessionToken: string): Promise<UserProfile | null> {
  const endpoints = [
    "wp-json/tripanza-headless/v1/me",
    `wp-json/tripanza-app/v1/profile?session_token=${encodeURIComponent(sessionToken)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${WORDPRESS_URL}/${endpoint}`, {
        cache: "no-store",
        headers: { Accept: "application/json", Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) return (await response.json()) as UserProfile;
    } catch {
      // Try the next supported profile endpoint.
    }
  }
  return null;
}

export async function getUserBookings(sessionToken: string): Promise<UserBooking[]> {
  const endpoints = [
    "wp-json/tripanza-headless/v1/my-bookings",
    `wp-json/tripanza-app/v1/bookings?session_token=${encodeURIComponent(sessionToken)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${WORDPRESS_URL}/${endpoint}`, {
        cache: "no-store",
        headers: { Accept: "application/json", Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as { orders?: UserBooking[]; items?: UserBooking[] } | UserBooking[];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.orders)) return payload.orders;
      if (Array.isArray(payload.items)) return payload.items;
    } catch {
      // Try the next supported bookings endpoint.
    }
  }
  return [];
}
