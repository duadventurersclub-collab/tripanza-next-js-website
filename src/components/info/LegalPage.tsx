import Link from "next/link";
import InfoHeader from "./InfoHeader";
import snapshot from "@/content/legal-policy-snapshot.json";
import CookiePreferencesButton from "@/components/settings/CookiePreferencesButton";

type PolicyKey = keyof typeof snapshot;

const policyInfo: Record<PolicyKey, { eyebrow: string; title: string; intro: string; date: string; notice?: string }> = {
  cancellation: {
    eyebrow: "Plans change. Clarity should not.",
    title: "Cancellation and Refund Policy",
    intro: "Charges, deductions, timelines and options when a Tripanza booking is cancelled or changed.",
    date: "Effective 17 October 2023 · Updated 22 August 2026",
    notice: "Package-specific cancellation terms disclosed before payment or in your booking confirmation apply to that booking, subject to applicable law.",
  },
  cookies: {
    eyebrow: "Simple, necessary, transparent",
    title: "Cookie Policy",
    intro: "How cookies and similar storage help keep the Tripanza website secure and working.",
    date: "Effective 17 October 2023 · Updated 22 August 2026",
  },
  disclaimer: {
    eyebrow: "The important details",
    title: "Disclaimer",
    intro: "Please read this before relying on travel-related information published through Tripanza.",
    date: "Updated 22 August 2026",
  },
  privacy: {
    eyebrow: "Your privacy matters",
    title: "Privacy Policy",
    intro: "What information Tripanza collects, why we use it, when we share it and your choices.",
    date: "Effective 17 October 2023",
  },
  terms: {
    eyebrow: "The details behind the journey",
    title: "Terms and Conditions",
    intro: "How bookings, payments, changes, cancellations and participation in Tripanza experiences work.",
    date: "Updated 22 August 2026",
  },
};

export default function LegalPage({ policy }: { policy: PolicyKey }) {
  const info = policyInfo[policy];
  const sections = snapshot[policy];
  return (
    <main className="tp-info-page tp-legal-page">
      <InfoHeader />
      <div className="tp-info-shell">
        <div className="tp-info-breadcrumb"><Link href="/">Home</Link><span>/</span><span>{info.title}</span></div>
        <div className="tp-info-hero tp-legal-hero"><span className="tp-info-kicker">{info.eyebrow}</span><h1>{info.title}</h1><p>{info.intro}</p><small>{info.date}</small></div>
        <div className="tp-legal-layout">
          <nav className="tp-legal-toc" aria-label={`${info.title} sections`}><strong>On this page</strong>{sections.map((section) => <a href={`#${section.id}`} key={section.id}>{section.title}</a>)}</nav>
          <article className="tp-legal-content">
            {info.notice && <div className="tp-legal-notice">{info.notice}</div>}
            {sections.map((section) => <section id={section.id} key={section.id} dangerouslySetInnerHTML={{ __html: section.html }} />)}
            {policy === "privacy" && <section><h2>Optional analytics and advertising measurement</h2><p>Updated 4 October 2026. If configured, Google Analytics 4 may receive a public page URL, browser/device information and cookie identifiers after you accept analytics. Meta Pixel may receive similar information after you accept marketing. We do not intentionally send booking tokens, form entries or private account URLs to these tools. You can change or withdraw these choices in our <Link href="/cookies-policy">Cookie Policy</Link>. Each provider may process data under its own terms; please review those before opting in.</p></section>}
            {policy === "privacy" && <section><h2>Optional WhatsApp trip follow-ups</h2><p>Updated 6 October 2026. When you separately choose WhatsApp trip follow-ups at signup, itinerary download or checkout, we may save your phone number, email if supplied, the time and source of that choice, and relevant tour views or unfinished checkout activity. We use this information to send a limited trip reminder through our existing WhatsApp bot. Providing a phone number for an OTP, PDF or booking alone does not enroll you. A booking stops pending reminders. You can withdraw the choice before a reminder at checkout, use the opt-out link in a message, or <Link href="/contact">contact us</Link>. This follow-up choice is separate from analytics and advertising cookies.</p></section>}
            {policy === "cookies" && <section><h2>Your optional tracking choices</h2><p>If Google Analytics or Meta Pixel is configured, neither loads before you opt in. You can change or withdraw your choice here at any time. Withdrawal stops future tracking on this site; it cannot recall data already received by a provider.</p><CookiePreferencesButton /></section>}
            {policy === "cookies" && <section><h2>WhatsApp follow-up preference</h2><p>If you separately opt in to WhatsApp trip follow-ups, an essential first-party identifier may remember that choice and connect relevant tour or checkout activity to your request. It is not used to enroll visitors who have not opted in. You may opt out using a message link or by <Link href="/contact">contacting us</Link>.</p></section>}
            <div className="tp-legal-help"><div><span>Still have a question?</span><h2>We’re here to help.</h2><p>Talk to a real person before you book or make changes to a trip.</p></div><Link href="/contact">Contact Tripanza <span aria-hidden="true">→</span></Link></div>
          </article>
        </div>
      </div>
    </main>
  );
}
