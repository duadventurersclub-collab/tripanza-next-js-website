import { getAppTours } from "@/lib/wp";
import ToursClient, { type TourCardData } from "./ToursClient";

export const revalidate = 300;

export default async function ToursPage({ searchParams }: { searchParams: Promise<{ admin_only?: string }> }) {
  const params = await searchParams;
  const { items: tours, total } = await getAppTours({ per_page: 100, admin_only: params.admin_only === "1" });
  const tourCards: TourCardData[] = tours.map((tour) => ({
    id: tour.id,
    slug: tour.slug,
    title: tour.title,
    excerpt: tour.excerpt,
    featured_image: tour.featured_image,
    price: tour.price,
    details: {
      origin: tour.details.origin,
      destination: tour.details.destination,
      duration: tour.details.duration,
      rating: tour.details.rating,
      pricing: {
        quad: tour.details.pricing.quad,
        triple: tour.details.pricing.triple,
        twin: tour.details.pricing.twin,
      },
      seats_left: tour.details.seats_left,
      cashback: tour.details.cashback,
      is_trending: tour.details.is_trending,
    },
  }));

  return <ToursClient tours={tourCards} total={total} />;
}
