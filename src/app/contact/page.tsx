import type { Metadata } from "next";
import Link from "next/link";
import InfoHeader from "@/components/info/InfoHeader";
import { getPublicSiteSettings } from "@/lib/public-site-settings";
import { publicPageMetadata } from "@/lib/search-discovery";

export const generateMetadata = (): Promise<Metadata> => publicPageMetadata("/contact", "Contact Us", "Contact Tripanza for trip planning, booking help, cancellations or any travel question.");

export default async function ContactPage() {
  const s = await getPublicSiteSettings();
  return (
    <main className="tp-info-page">
      <InfoHeader />
      <div className="tp-info-shell">
        <div className="tp-info-breadcrumb"><Link href="/">Home</Link><span>/</span><span>Contact us</span></div>
        <div className="tp-info-hero"><span className="tp-info-kicker">We are here to help</span><h1>Your next great story starts with hello.</h1><p>Bring us the destination, the dream or even just a rough idea. Our travel team will help turn it into a journey worth talking about.</p></div>
        <section className="tp-story-section tp-contact-section"><span>Choose your route</span><h2>Talk to a real person.</h2><p>Questions about a trip, an existing booking, or a policy? Reach us in whichever way feels easiest.</p><div className="tp-contact-cards"><a href={`tel:${s.contact_phone}`}><h3>Call us</h3><p>{s.contact_phone}</p></a><a href={`mailto:${s.contact_email}`}><h3>Email us</h3><p>{s.contact_email}</p></a><div><h3>Find us</h3><p>{s.contact_address}</p></div></div><div className="tp-contact-actions"><a className="tp-info-cta" href={`https://wa.me/${s.whatsapp_number}`} target="_blank" rel="noopener noreferrer">Chat on WhatsApp →</a><a className="tp-info-cta" href={`mailto:${s.contact_email}?subject=Tripanza%20enquiry`}>Send an email →</a>{s.instagram_url && <a className="tp-info-cta" href={s.instagram_url} target="_blank" rel="noopener noreferrer">Instagram →</a>}{s.facebook_url && <a className="tp-info-cta" href={s.facebook_url} target="_blank" rel="noopener noreferrer">Facebook →</a>}</div><div className="tp-contact-note"><strong>For cancellations and refunds:</strong> email your booking reference, lead traveller name and departure date to <a href={`mailto:${s.contact_email}`}>{s.contact_email}</a>. Written requests help us track your case accurately.</div></section>
      </div>
    </main>
  );
}
