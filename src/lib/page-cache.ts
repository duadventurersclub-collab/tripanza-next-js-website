import { revalidatePath, revalidateTag } from "next/cache";

export type PublicCachePage = { path: string; title: string; kind: "page" | "tour" };

// Only public, non-personalized destinations belong in a shared page cache.
// /tours and /trips redirect to the homepage; account, checkout, Host and
// admin pages can contain visitor-specific data and must never be warmed.
export const STATIC_CACHE_PAGES: PublicCachePage[] = [
  { path: "/", title: "Homepage", kind: "page" },
  { path: "/about", title: "About us", kind: "page" },
  { path: "/contact", title: "Contact us", kind: "page" },
  { path: "/cancellation-policy", title: "Cancellation and refund policy", kind: "page" },
  { path: "/cookies-policy", title: "Cookie policy", kind: "page" },
  { path: "/disclaimer", title: "Disclaimer", kind: "page" },
  { path: "/privacy-policy", title: "Privacy policy", kind: "page" },
  { path: "/tnc", title: "Terms and conditions", kind: "page" },
];

export function cachePagePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (STATIC_CACHE_PAGES.some(page => page.path === raw)) return raw;
  return /^\/tours\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw) ? raw : null;
}

export function clearPublicPageCache(path: string) {
  if (path === "/") {
    revalidateTag("homepage", { expire: 0 });
    revalidatePath("/");
    revalidatePath("/home-cache/home");
    return;
  }
  if (path.startsWith("/tours/")) revalidateTag(`tour:${path.slice(7)}`, { expire: 0 });
  revalidatePath(path);
}
