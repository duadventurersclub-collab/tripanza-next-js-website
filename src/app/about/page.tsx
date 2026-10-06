import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import InfoHeader from "@/components/info/InfoHeader";
import { publicPageMetadata } from "@/lib/search-discovery";

export const generateMetadata = (): Promise<Metadata> => publicPageMetadata("/about", "About Us", "Meet the people and purpose behind Tripanza's community-led group trips.");

export default function AboutPage() {
  return (
    <main className="tp-info-page">
      <InfoHeader />
      <div className="tp-info-shell">
        <div className="tp-info-breadcrumb"><Link href="/">Home</Link><span>/</span><span>About us</span></div>
        <div className="tp-story-hero">
          <div className="tp-info-hero"><span className="tp-info-kicker">Born in Delhi. Built for everywhere.</span><h1>We don’t sell tours. We create stories.</h1><p>Tripanza, a unit of DU Adventurers Club, is a travel-tech community for young explorers who want better people, real moments and trips that stay with them.</p></div>
          <div className="tp-story-image"><Image src="https://tripanza.com/wp-content/uploads/2022/09/WhatsApp-Image-2022-09-16-at-2.04.56-AM.jpeg" alt="Tripanza travellers exploring together" width={900} height={720} unoptimized /></div>
        </div>
        <section className="tp-story-section"><span>Why we exist</span><h2>Travel should feel alive.</h2><p>The best journeys are rarely the most predictable ones. They are the sunrise after an overnight bus, the inside joke born on a mountain trail, and the strangers who feel like old friends by the ride home. That belief shaped Tripanza: thoughtful group travel, powered by technology but centred on human connection.</p>
          <div className="tp-story-cards"><article><b>2016 · The first chapter</b><h3>DU Adventurers Club begins</h3><p>A few Delhi University students, a bus and some backpacks turned weekend escapes into something bigger.</p></article><article><b>The real discovery</b><h3>People mattered most</h3><p>Destinations brought everyone together. The friendships and shared stories are what they carried home.</p></article><article><b>Today · Tripanza</b><h3>Community meets technology</h3><p>Hands-on travel experience and smart tools make curated group trips simpler and more personal.</p></article></div>
        </section>
        <section className="tp-story-section"><span>The Tripanza way</span><h2>People first. Curated trips. Human technology.</h2><div className="tp-story-cards"><article><b>01</b><h3>People before packages</h3><p>A great itinerary means little without the right group and a team that genuinely cares.</p></article><article><b>02</b><h3>Curated, never copied</h3><p>Every experience should have a reason to exist, not feel like another generic tour.</p></article><article><b>03</b><h3>Technology with a human pulse</h3><p>Smart systems should remove friction and make more room for connection and fun.</p></article></div></section>
        <section className="tp-story-section"><span>The people behind it</span><h2>Built by travellers, for travellers.</h2><div className="tp-story-people"><article><strong>Founder &amp; developer</strong><h3>Akshay Verma</h3><p>From organising college trips to building the technology behind Tripanza, Akshay brings lived travel experience to the product.</p></article><article><strong>Co-founder &amp; head of sales</strong><h3>Yashika Taneja</h3><p>Yashika brings commercial instinct and people-first energy to journeys people cannot wait to join.</p></article></div><div className="tp-contact-actions"><Link className="tp-info-cta" href="/?tripanza_view=all#trips">Explore upcoming trips →</Link><Link className="tp-info-cta" href="/contact">Get in touch →</Link></div></section>
      </div>
    </main>
  );
}
