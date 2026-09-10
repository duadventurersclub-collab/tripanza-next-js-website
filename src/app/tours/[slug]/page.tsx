import { notFound } from "next/navigation";
import { getTourBySlug, getAppTourAvailability, type TourAvailabilityBatch } from "@/lib/wp";
import type { Metadata } from "next";

// Components
import TourAppbar from "@/components/tour/TourAppbar";
import TourGallery from "@/components/tour/TourGallery";
import TourOverview from "@/components/tour/TourOverview";
import TourInformation from "@/components/tour/TourInformation";
import TourItinerary from "@/components/tour/TourItinerary";

// Scoped design CSS from PHP templates
import "./tour-design.css";

export const dynamic = "force-dynamic";

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

  // Retrieve live departure batches if available
  let availabilityBatches: TourAvailabilityBatch[] = [];
  try {
    availabilityBatches = await getAppTourAvailability(tour.id);
  } catch {
    availabilityBatches = [];
  }

  const whatsappMsg = encodeURIComponent(
    `Hey Tripanza Team! I am interested in the ${tour.title} (${tour.details.duration.days}D/${tour.details.duration.nights}N). Could you please share the next departure batch dates and availability?`
  );
  const whatsappUrl = `https://wa.me/919999999999?text=${whatsappMsg}`;

  return (
    <div className="tripanza-single-tour-app">
      {/* Scroll Progress (purely visual, client-side) */}
      <div className="tripanza-tour-scroll" aria-hidden="true">
        <span id="tp-scroll-bar" />
      </div>

      {/* Sticky Appbar + Share Sheet */}
      <TourAppbar tour={tour} />

      <main className="tripanza-tour-document">
        {/* Full-bleed Gallery with Trust Tags */}
        <TourGallery tour={tour} />

        {/* Content container */}
        <div style={{ padding: "0 clamp(14px, 4vw, 48px)", maxWidth: 960, margin: "0 auto" }}>
          {/* Overview: title, value card, route, AI, reels, organizer */}
          <TourOverview tour={tour} whatsappUrl={whatsappUrl} />

          {/* Information: stats, prices, availability dates, download CTA */}
          <TourInformation
            tour={tour}
            availabilityBatches={availabilityBatches}
            whatsappUrl={whatsappUrl}
          />

          {/* Itinerary: days, highlights, stays, inc/exc, FAQs */}
          <TourItinerary tour={tour} />
        </div>

        {/* Spacer for mobile sticky bottom bar */}
        <div style={{ height: 96 }} aria-hidden="true" />
      </main>

      {/* Mobile Sticky Bottom Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10010,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 20px calc(12px + env(safe-area-inset-bottom))",
          borderTop: "1px solid #e2e7f0",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 -16px 40px rgba(27,35,64,.12)",
          fontFamily: "Inter, ui-sans-serif, sans-serif",
        }}
        aria-label="Quick booking bar"
      >
        <div>
          <span style={{ display: "block", fontSize: 9, fontWeight: 800, color: "#7a8494", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Starting from
          </span>
          <span style={{ display: "block", fontSize: 20, fontWeight: 900, color: "#171923", letterSpacing: "-0.035em" }}>
            {tour.details.pricing.starting_price || tour.price}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp inquiry"
            style={{
              display: "grid",
              width: 46,
              height: 46,
              placeItems: "center",
              border: "1px solid #e2e7f0",
              borderRadius: 14,
              color: "#25d366",
              background: "#fff",
              fontSize: 18,
              textDecoration: "none",
            }}
          >
            <i className="fa-brands fa-whatsapp" aria-hidden="true" />
          </a>
          <a
            href={`/booking?tour=${tour.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "0 20px",
              height: 46,
              borderRadius: 14,
              color: "#171923",
              background: "#d0e562",
              fontWeight: 900,
              fontSize: 13,
              textDecoration: "none",
              boxShadow: "0 6px 18px rgba(170,200,0,.22)",
            }}
          >
            <i className="fa-solid fa-bolt" aria-hidden="true" />
            Book Seat
          </a>
        </div>
      </div>

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
