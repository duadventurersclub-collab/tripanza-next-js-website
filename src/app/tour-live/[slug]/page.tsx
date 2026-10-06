import TourDetailPage, { generateMetadata as tourMetadata } from "@/components/tour/TourDetailPage";

// Used only when Site Controls disables public tour caching. The proxy preserves
// /tours/[slug] in the browser and redirects direct visits to this internal URL.
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export const generateMetadata = ({ params }: Props) => tourMetadata({ params, live: true });
export default function LiveTourPage({ params }: Props) {
  return <TourDetailPage params={params} live />;
}
