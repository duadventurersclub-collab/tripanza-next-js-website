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
  TourBulkDiscount,
  TourBookingExtra,
  TourInsight,
  TourPartner,
  TourPricingMatrix,
  TourReview,
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
  state?: string;
  dob?: string;
  gender?: "male" | "female" | "";
  cover_url?: string;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  type: "credit" | "debit";
  source: "cashback" | "commission" | "general";
  description: string;
  date: string;
  coupon_code: string;
}

export interface UserWallet {
  currency: string;
  balance: number;
  source_balances: { cashback: number; commission: number; general: number };
  stats: { earned: number; used: number; movements: number };
  transactions: WalletTransaction[];
  updated_at?: string;
}

export interface UserAccount {
  id: number;
  name: string;
  email: string;
  roles: string[];
  avatar: string;
  wallet: UserWallet;
  bookings_count: number;
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
  const endpoints = ["wp-json/tripanza-headless/v1/me"];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${WORDPRESS_URL}/${endpoint}`, {
        cache: "no-store",
        headers: { Accept: "application/json", Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        const payload = (await response.json()) as Partial<UserProfile> & { name?: string; avatar?: string };
        const displayName = payload.display_name || payload.name || [payload.first_name, payload.last_name].filter(Boolean).join(" ");
        return {
          id: Number(payload.id) || 0,
          email: payload.email || "",
          first_name: payload.first_name || displayName.split(" ")[0] || "",
          last_name: payload.last_name || displayName.split(" ").slice(1).join(" "),
          phone: payload.phone || "",
          display_name: displayName || "Tripanza traveller",
          avatar_url: payload.avatar_url || payload.avatar || "",
          state: payload.state || "",
          dob: payload.dob || "",
          gender: payload.gender === "male" || payload.gender === "female" ? payload.gender : "",
          cover_url: payload.cover_url || "",
        };
      }
    } catch {
      // Try the next supported profile endpoint.
    }
  }
  return null;
}

export async function getUserBookings(sessionToken: string): Promise<UserBooking[]> {
  const endpoints = ["wp-json/tripanza-headless/v1/my-bookings"];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${WORDPRESS_URL}/${endpoint}`, {
        cache: "no-store",
        headers: { Accept: "application/json", Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as { orders?: UserBooking[]; items?: UserBooking[] } | UserBooking[];
      const rawItems = Array.isArray(payload) ? payload : Array.isArray(payload.orders) ? payload.orders : payload.items;
      if (Array.isArray(rawItems)) {
        return rawItems.map((item) => {
          const raw = item as UserBooking & { total?: string };
          return { ...raw, amount: String(raw.amount ?? raw.total ?? "0") };
        });
      }
    } catch {
      // Try the next supported bookings endpoint.
    }
  }
  return [];
}

export async function getUserAccount(sessionToken: string): Promise<UserAccount | null> {
  const endpoints = ["wp-json/tripanza-headless/v1/account"];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${WORDPRESS_URL}/${endpoint}`, {
        cache: "no-store",
        headers: { Accept: "application/json", Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as Partial<UserAccount>;
      return {
        id: Number(payload.id) || 0,
        name: payload.name || "Tripanza traveller",
        email: payload.email || "",
        roles: Array.isArray(payload.roles) ? payload.roles : [],
        avatar: payload.avatar || "",
        wallet: {
          currency: payload.wallet?.currency || "INR",
          balance: Number(payload.wallet?.balance) || 0,
          source_balances: {
            cashback: Number(payload.wallet?.source_balances?.cashback) || 0,
            commission: Number(payload.wallet?.source_balances?.commission) || 0,
            general: Number(payload.wallet?.source_balances?.general) || 0,
          },
          stats: {
            earned: Number(payload.wallet?.stats?.earned) || 0,
            used: Number(payload.wallet?.stats?.used) || 0,
            movements: Number(payload.wallet?.stats?.movements) || 0,
          },
          transactions: Array.isArray(payload.wallet?.transactions) ? payload.wallet.transactions : [],
          updated_at: payload.wallet?.updated_at,
        },
        bookings_count: Number(payload.bookings_count) || 0,
      };
    } catch {
      // Try the next supported account endpoint.
    }
  }
  return null;
}

export async function getUserWallet(sessionToken: string): Promise<UserWallet | null> {
  try {
    const response = await fetch(`${WORDPRESS_URL}/wp-json/tripanza-headless/v1/wallet`, {
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Partial<UserWallet>;
    return {
      currency: payload.currency || "INR",
      balance: Number(payload.balance) || 0,
      source_balances: {
        cashback: Number(payload.source_balances?.cashback) || 0,
        commission: Number(payload.source_balances?.commission) || 0,
        general: Number(payload.source_balances?.general) || 0,
      },
      stats: {
        earned: Number(payload.stats?.earned) || 0,
        used: Number(payload.stats?.used) || 0,
        movements: Number(payload.stats?.movements) || 0,
      },
      transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
      updated_at: payload.updated_at,
    };
  } catch {
    return null;
  }
}

export type ProfileUpdate = Pick<UserProfile, "email"> & {
  name: string;
  phone: string;
  state: string;
  dob: string;
  gender: "male" | "female";
};

export async function updateUserProfile(sessionToken: string, input: ProfileUpdate): Promise<UserProfile> {
  const response = await fetch(`${WORDPRESS_URL}/wp-json/tripanza-headless/v1/profile`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    profile?: Partial<UserProfile> & { name?: string; avatar?: string };
  };
  if (!response.ok || !payload.profile) throw new Error(payload.message || "Could not update your profile.");
  const profile = payload.profile;
  return {
    id: Number(profile.id) || 0,
    email: profile.email || "",
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    phone: profile.phone || "",
    display_name: profile.display_name || profile.name || "Tripanza traveller",
    avatar_url: profile.avatar_url || profile.avatar || "",
    state: profile.state || "",
    dob: profile.dob || "",
    gender: profile.gender === "male" || profile.gender === "female" ? profile.gender : "",
    cover_url: profile.cover_url || "",
  };
}
