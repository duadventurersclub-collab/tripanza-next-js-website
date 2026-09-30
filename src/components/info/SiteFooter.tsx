import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="tp-site-footer">
      <div className="tp-site-footer__inner">
        <div className="tp-site-footer__brand"><Link href="/">tripanza<span>.</span></Link><p>Made for the group chat that actually travels.</p></div>
        <nav aria-label="Company and policy pages">
          <div><strong>Company</strong><Link href="/about">About us</Link><Link href="/contact">Contact us</Link><Link href="/tours">Explore trips</Link></div>
          <div><strong>Help &amp; policies</strong><Link href="/cancellation-policy">Cancellation &amp; refunds</Link><Link href="/cookies-policy">Cookie policy</Link><Link href="/disclaimer">Disclaimer</Link></div>
          <div><strong>Legal</strong><Link href="/privacy-policy">Privacy policy</Link><Link href="/tnc">Terms &amp; conditions</Link><a href="mailto:hello@tripanza.com">hello@tripanza.com</a></div>
        </nav>
      </div>
      <div className="tp-site-footer__bottom">© {new Date().getFullYear()} Tripanza · A unit of DU Adventurers Club</div>
    </footer>
  );
}
