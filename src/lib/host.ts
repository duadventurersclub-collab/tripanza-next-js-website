import { getSessionToken } from "@/lib/session";

export type HostTour = {
  id: number;
  slug: string;
  title: string;
  image: string;
  address: string;
  duration: string;
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
  tagline: string;
  bio: string;
  cover: string;
  instagram: string;
  rating: number;
  theme: string;
  font: string;
  palette: Record<string, string>;
  trips: HostTour[];
};
export type HostBooking = {
  id: number; tour_id: number; tour_title: string; customer: string; email: string; phone: string;
  guests: number; check_in: string; status: string; payment_status: string; total: number;
  advance: number; balance: number; adjustment: number; commission_per_person: number; host_earnings: number; created_at: string;
};
export type HostReel = { id: number; video: string; title: string; tour: Pick<HostTour, "id" | "slug" | "title" | "image" | "address" | "duration">; date: string };
export type HostDashboard = {
  profile: HostSummary;
  stats: { trips: number; bookings: number; confirmed: number; guests: number; revenue: number; earnings: number; pipeline: number };
  payout_ready: boolean;
  recent_bookings: HostBooking[];
  trips: HostTour[];
};
export type HostPayout = { locked: boolean; method: "bank" | "upi"; account_holder: string; bank_name: string; account_masked: string; ifsc_masked: string; upi_masked: string };

const base = (process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://tripanza.com").replace(/\/$/, "");

export async function getPublicHostData<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const response = await fetch(`${base}/wp-json/tripanza-headless/v1/${path}`, { ...(revalidate === 0 ? { cache: "no-store" as const } : { next: { revalidate } }), headers: { Accept: "application/json" } });
    return response.ok ? response.json() as Promise<T> : null;
  } catch { return null; }
}

export async function getPrivateHostData<T>(path: string): Promise<T | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const response = await fetch(`${base}/wp-json/tripanza-headless/v1/${path}`, {
      cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    return response.ok ? response.json() as Promise<T> : null;
  } catch { return null; }
}
