import { cookies } from "next/headers";

export const BOOKING_CART_COOKIE = "tripanza_booking_cart";

export type BookingExtraSelection = { name: string; quantity: number };

export type BookingSelection = {
  tour_id: number;
  date: string;
  counts: { quad: number; triple: number; twin: number };
  extras: BookingExtraSelection[];
};

export type BookingQuote = {
  quote_id: string;
  currency: string;
  tour: { id: number; slug: string; title: string; image: string };
  departure: {
    date: string;
    display_date?: string;
    check_in: string;
    check_out: string;
    check_in_timestamp: number;
    check_out_timestamp: number;
  };
  travellers: { quad: number; triple: number; twin: number; total: number };
  unit_prices: { quad: number; triple: number; twin: number };
  discount: { rate: number; type: "amount" | "percent" };
  extras: Array<{ name: string; price: number; required: boolean; quantity: number; total: number }>;
  amounts: {
    package: number;
    sale_discount: number;
    group_discount: number;
    extras: number;
    tax: number;
    trip_total: number;
    grand_total: number;
    pay_now: number;
    pay_later: number;
  };
  deposit: { percentage: number };
  expires_at: string;
};

export type BookingCart = { selection: BookingSelection; quote: BookingQuote; updated_at: string };

export type CheckoutContact = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  note?: string;
};

export type BookingTraveller = { title: string; name: string; age?: number };

export type BookingCreated = {
  success: boolean;
  booking_id: number;
  order_token: string;
  status: string;
  amount: number;
  currency: string;
  payment_url: string;
  payment_urls: { payu: string; upi: string; status: string };
};

export type PayUPaymentSession = {
  method: "payu";
  booking_id: number;
  tour_title: string;
  amount: number;
  processing_fee: number;
  payable_amount: number;
  currency: string;
  payment_status: string;
  payu: { action: string; fields: Record<string, string> };
};

export type UpiPaymentSession = {
  method: "upi";
  booking_id: number;
  tour_title: string;
  amount: number;
  currency: string;
  payment_status: string;
  upi: {
    upi_id: string;
    payee_name: string;
    payment_url: string;
    google_pay_url: string;
    google_pay_ios_url: string;
    phonepe_url: string;
    paytm_url: string;
    existing_transaction: string;
  };
};

export type PaymentSession = PayUPaymentSession | UpiPaymentSession;

export type PaymentStatus = {
  booking_id: number;
  tour_title: string;
  amount: number;
  currency: string;
  payment_status: string;
};

const WORDPRESS_URL = (
  process.env.WORDPRESS_URL ||
  process.env.NEXT_PUBLIC_WORDPRESS_URL ||
  "https://tripanza.com"
).replace(/\/$/, "");

export class BookingApiError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
  }
}

async function wordpressPost<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${WORDPRESS_URL}/wp-json/tripanza-headless/v1/${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as { message?: string } | T | null;
  if (!response.ok) {
    throw new BookingApiError(
      data && typeof data === "object" && "message" in data && data.message
        ? data.message
        : "WordPress could not validate this booking.",
      response.status,
    );
  }
  return data as T;
}

async function wordpressGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const search = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  const response = await fetch(`${WORDPRESS_URL}/wp-json/tripanza-headless/v1/${path}?${search}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const data = (await response.json().catch(() => null)) as { message?: string } | T | null;
  if (!response.ok) {
    throw new BookingApiError(
      data && typeof data === "object" && "message" in data && data.message
        ? data.message
        : "WordPress could not load this payment.",
      response.status,
    );
  }
  return data as T;
}

export function requestBookingQuote(selection: BookingSelection) {
  return wordpressPost<BookingQuote>("booking/quote", selection);
}

export function createWordPressBooking(payload: BookingSelection & {
  contact: CheckoutContact;
  travellers: BookingTraveller[];
  payment_method: "payu" | "upi";
  idempotency_key: string;
}) {
  return wordpressPost<BookingCreated>("booking", payload);
}

export function requestPaymentSession(payload: {
  booking_id: number;
  token: string;
  method: "payu" | "upi";
  callback_url: string;
}) {
  return wordpressPost<PaymentSession>("booking/payment", payload);
}

export function submitUpiPayment(payload: {
  booking_id: number;
  token: string;
  transaction_id: string;
  transaction_date: string;
}) {
  return wordpressPost<{ success: boolean; booking_id: number; transaction_id: string; payment_status: string; message: string }>("booking/payment/upi", payload);
}

export function verifyPayUPayment(payload: {
  booking_id: number;
  token: string;
  payload: Record<string, string>;
}) {
  return wordpressPost<{ success: boolean; booking_id: number; state: "success" | "failed"; payment_status: string; amount: number; transaction_id: string; message: string }>("booking/payment/payu/verify", payload);
}

export function getPaymentStatus(bookingId: number, token: string) {
  return wordpressGet<PaymentStatus>("checkout", { booking_id: bookingId, token });
}

function encodeCart(cart: BookingCart) {
  return Buffer.from(JSON.stringify(cart), "utf8").toString("base64url");
}

function decodeCart(value: string): BookingCart | null {
  try {
    const cart = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as BookingCart;
    if (!cart?.selection?.tour_id || !cart?.selection?.date || !cart?.quote?.quote_id) return null;
    return cart;
  } catch {
    return null;
  }
}

export async function getBookingCart(): Promise<BookingCart | null> {
  const value = (await cookies()).get(BOOKING_CART_COOKIE)?.value;
  return value ? decodeCart(value) : null;
}

export async function setBookingCart(cart: BookingCart) {
  (await cookies()).set(BOOKING_CART_COOKIE, encodeCart(cart), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
    priority: "high",
  });
}

export async function clearBookingCart() {
  (await cookies()).delete(BOOKING_CART_COOKIE);
}

export function formatBookingMoney(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
