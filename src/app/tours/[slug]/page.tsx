import { notFound } from "next/navigation";
import Link from "next/link";
import { getTourBySlug } from "@/lib/wp";
import type { Metadata } from "next";

// Components
import TourAppbar from "@/components/tour/TourAppbar";
import TourGallery from "@/components/tour/TourGallery";
import TourOverview from "@/components/tour/TourOverview";
import TourReels from "@/components/tour/TourReels";
import TourInformation from "@/components/tour/TourInformation";
import TourItinerary from "@/components/tour/TourItinerary";
import TourAboutDiscounts from "@/components/tour/TourAboutDiscounts";
import TourBookingPanel from "@/components/tour/TourBookingPanel";
import TourMobileBooking from "@/components/tour/TourMobileBooking";
import TourReviews from "@/components/tour/TourReviews";
import TourSectionNav from "@/components/tour/TourSectionNav";

// Scoped design CSS from PHP templates
import "./tour-design.css";
import "./tour-app.css";
import "./tour-kanika.css";

export const revalidate = 300;

// New slugs are generated on first request and then retained by ISR.
export function generateStaticParams() {
  return [];
}

interface TourDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TourDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const tour = await getTourBySlug(slug);
    if (!tour) return { title: "Tour Not Found" };
    return {
      title: `${tour.title} | Tripanza`,
      description: tour.excerpt || `Join the ${tour.title} trip with Tripanza — ${tour.details.duration.days} Days / ${tour.details.duration.nights} Nights from ${tour.details.origin}.`,
      openGraph: {
        title: tour.title,
        description: tour.excerpt,
        images: tour.featured_image ? [{ url: tour.featured_image }] : [],
      },
    };
  } catch {
    return { title: "Tripanza Tour" };
  }
}

export default async function TourDetailPage({ params }: TourDetailPageProps) {
  const { slug } = await params;
  const tour = await getTourBySlug(slug);

  if (!tour) {
    notFound();
  }

  const whatsappMsg = encodeURIComponent(
    `Hey Tripanza Team! I am interested in the ${tour.title} (${tour.details.duration.days}D/${tour.details.duration.nights}N). Could you please share the next departure batch dates and availability?`
  );
  const whatsappNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMsg}`;
  const sections = [
    { id: "tp-trip-overview", label: "Overview" },
    ...(tour.details.reels.length ? [{ id: "reels", label: "Vibes" }] : []),
    ...(tour.details.itinerary.length ? [{ id: "tp-trip-days", label: "Itinerary" }] : []),
    ...(tour.details.highlights.length ? [{ id: "tp-trip-highlights", label: "Highlights" }] : []),
    ...(tour.details.stays.length ? [{ id: "tp-trip-stays", label: "Stays" }] : []),
    ...(tour.details.included.length || tour.details.excluded.length ? [{ id: "tp-trip-cover", label: "Inclusions" }] : []),
    ...(tour.details.faqs.length ? [{ id: "tp-trip-faq", label: "FAQs" }] : []),
    { id: "tp-trip-dates", label: "Dates & prices" },
  ];

  return (
    <div className="tripanza-single-tour-app tp-app-v2">
      {/* Scroll Progress (purely visual, client-side) */}
      <div className="tripanza-tour-scroll" aria-hidden="true">
        <span id="tp-scroll-bar" />
      </div>

      {/* Sticky Appbar + Share Sheet */}
      <TourAppbar tour={tour} />

      <main className="tripanza-tour-document">
        {/* Full-bleed Gallery with Trust Tags */}
        <TourGallery tour={tour} />
        <TourSectionNav sections={sections} />

        {/* Main details and desktop booking column */}
        <div className="tp-tour-layout">
          <div className="tp-tour-main">
            <TourOverview tour={tour} whatsappUrl={whatsappUrl} />
            <TourReels tour={tour} />
            <TourItinerary tour={tour} />
            <TourInformation tour={tour} availabilityBatches={[]} whatsappUrl={whatsappUrl} />
            <TourAboutDiscounts tour={tour} />
            <TourReviews reviews={tour.details.reviews} />
          </div>
          <TourBookingPanel tour={tour} />
        </div>

        {/* Spacer for mobile sticky bottom bar */}
        <footer className="tp-app-signoff"><span>See you out there.</span><strong>Good trips. Better people.</strong><Link href="/tours">Find your next escape <span aria-hidden="true">↗</span></Link></footer>
        <div className="tp-app-bottom-space" aria-hidden="true" />
      </main>

      <TourMobileBooking tour={tour} whatsappUrl={whatsappUrl} />

      {/* Scroll progress script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  var bar = document.getElementById('tp-scroll-bar');
  if (!bar) return;
  function update() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h <= 0) return;
    bar.style.transform = 'scaleX(' + Math.min(1, window.scrollY / h) + ')';
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
})();
          `.trim(),
        }}
      />
    </div>
  );
}
