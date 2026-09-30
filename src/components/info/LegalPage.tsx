import Link from "next/link";
import InfoHeader from "./InfoHeader";
import snapshot from "@/content/legal-policy-snapshot.json";

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
            <div className="tp-legal-help"><div><span>Still have a question?</span><h2>We’re here to help.</h2><p>Talk to a real person before you book or make changes to a trip.</p></div><Link href="/contact">Contact Tripanza <span aria-hidden="true">→</span></Link></div>
          </article>
        </div>
      </div>
    </main>
  );
}
