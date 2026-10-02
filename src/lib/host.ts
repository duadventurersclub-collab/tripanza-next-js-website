import { getSessionToken } from "@/lib/session";
import { getSiteSettings, publicCacheOptions } from "./site-settings";

export type HostTour = {
  id: number;
  slug: string;
  title: string;
  image: string;
  gallery?: string[];
  pdf_url?: string;
  address: string;
  duration: string;
  price?: number;
  old_price?: number;
  rating?: number;
  reviews?: number;
  sold_out?: boolean;
  premium?: boolean;
  parent_id: number;
  inventory_id: number;
  host_id: number;
  selected_dates: string[];
  markup: Record<string, number>;
  commission_per_person?: number;
  departures?: { date: string; check_in: number; check_out: number; adult_price: number; child_price: number; infant_price: number; status: string }[];
};

export type HostSummary = { id: number; slug: string; name: string; logo: string; verified: boolean; trip_count: number };
export type HostProfile = HostSummary & {
  phone?: string;
  help_whatsapp_url?: string;
  call_url?: string;
  tagline: string;
  bio: string;
  cover: string;
  instagram: string;
  rating: number;
  theme: string;
  font: string;
  palette: Record<string, string>;
  trips: HostTour[];
  stays?: { tour_title: string; tour_slug: string; title: string; location: string; type: string; images: string[]; amenities: string[] }[];
  deals?: { title: string; slug: string; cover: string; destination: string; duration: string; price: number; old_price: number; tags: { kind: string; label: string }[] }[];
};
export type HostBooking = {
  id: number; tour_id: number; tour_title: string; tour_slug?: string; customer: string; email: string; phone: string;
  guests: number; check_in: string; status: string; payment_status: string; total: number;
  advance: number; balance: number; adjustment: number; commission_per_person: number; host_earnings: number; created_at: string;
  commission_credited?: boolean; bank_paid?: boolean;
};
export type HostReel = { id: number; video: string; title: string; tour: Pick<HostTour, "id" | "slug" | "title" | "image" | "address" | "duration">; date: string };
export type HostDashboard = {
  profile: HostSummary;
  stats: { trips: number; bookings: number; confirmed: number; guests: number; revenue: number; earnings: number; pipeline: number };
  payout_ready: boolean;
  first_name?: string;
  wallet_balance?: number;
  bank_paid?: number;
  upcoming?: number;
  months?: { label: string; revenue: number; profit: number }[];
  leaderboard?: { id: number; name: string; slug: string; avatar: string; verified: boolean; revenue: number; earnings: number; bookings: number }[];
  recent_bookings: HostBooking[];
  trips: HostTour[];
};
export type HostPayout = { locked: boolean; method: "bank" | "upi"; account_holder: string; bank_name: string; account_masked: string; ifsc_masked: string; upi_masked: string };

const base = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");

export async function getPublicHostData<T>(path: string, revalidate = 60): Promise<T | null> {
  if (!(await getSiteSettings()).host_enabled) return null;
  try {
    const response = await fetch(`${base}/wp-json/tripanza-headless/v1/${path}`, { headers: { Accept: "application/json" }, ...await publicCacheOptions("host", ["hosts"], revalidate === 0) });
    return response.ok ? response.json() as Promise<T> : null;
  } catch { return null; }
}

export async function getPrivateHostData<T>(path: string): Promise<T | null> {
  if (!(await getSiteSettings()).host_enabled) return null;
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const response = await fetch(`${base}/wp-json/tripanza-headless/v1/${path}`, {
      cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    return response.ok ? response.json() as Promise<T> : null;
  } catch { return null; }
}
