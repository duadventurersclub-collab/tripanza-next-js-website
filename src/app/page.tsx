import { getFeaturedTours, getSiteConfig, type SiteConfig, type TourSummary } from "@/lib/wp";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

const fallbackSite: SiteConfig = {
  name: "Tripanza",
  description: "India's coolest travel community",
  url: "https://tripanza.com",
  admin_url: "",
  site_language: "en-IN",
  timezone: "Asia/Kolkata",
};

const fallbackTours: TourSummary[] = [
  { id: 1, slug: "himachal-weekend", title: "Himachal Weekend Escape", excerpt: "Mountain air, cosy stays and a proper crew.", featured_image: "https://tripanza.com/wp-content/uploads/2022/09/WhatsApp-Image-2022-09-16-at-2.04.56-AM.jpeg", price: "₹6,999", currency: "INR", link: "/tours/himachal-weekend" },
  { id: 2, slug: "goa-getaway", title: "Goa Beach Getaway", excerpt: "Sunsets, playlists and the people you came to meet.", featured_image: "https://tripanza.com/wp-content/uploads/2021/06/WhatsApp-Image-2021-07-12-at-2.28.22-AM-15-e1662666832961.jpeg", price: "₹7,999", currency: "INR", link: "/tours/goa-getaway" },
  { id: 3, slug: "kasol-escape", title: "Kasol & Kheerganga Escape", excerpt: "A weekend for the group chat to remember.", featured_image: "https://tripanza.com/wp-content/uploads/2022/09/WhatsApp-Image-2022-09-16-at-2.04.56-AM.jpeg", price: "₹5,999", currency: "INR", link: "/tours/kasol-escape" },
  { id: 4, slug: "jaisalmer-desert-trip", title: "Jaisalmer Desert Trip", excerpt: "Dunes, stars and a camera roll full of stories.", featured_image: "https://tripanza.com/wp-content/uploads/2021/06/WhatsApp-Image-2021-07-12-at-2.28.22-AM-15-e1662666832961.jpeg", price: "₹8,499", currency: "INR", link: "/tours/jaisalmer-desert-trip" },
  { id: 5, slug: "manali-snow-trip", title: "Manali Snow Trip", excerpt: "Snow days, café stops and mountain people.", featured_image: "https://tripanza.com/wp-content/uploads/2022/09/WhatsApp-Image-2022-09-16-at-2.04.56-AM.jpeg", price: "₹7,499", currency: "INR", link: "/tours/manali-snow-trip" },
  { id: 6, slug: "rishikesh-weekender", title: "Rishikesh Weekender", excerpt: "Rafting, riverside mornings and an easy escape.", featured_image: "https://tripanza.com/wp-content/uploads/2021/06/WhatsApp-Image-2021-07-12-at-2.28.22-AM-15-e1662666832961.jpeg", price: "₹4,999", currency: "INR", link: "/tours/rishikesh-weekender" },
];

export default async function Home() {
  const [siteResult, toursResult] = await Promise.allSettled([getSiteConfig(), getFeaturedTours(9)]);
  const site = siteResult.status === "fulfilled" ? siteResult.value : fallbackSite;
  const tours = toursResult.status === "fulfilled" && toursResult.value.items.length ? toursResult.value : { items: fallbackTours, total: fallbackTours.length };

  return <HomeClient siteName={site.name} tours={tours.items} />;
}
