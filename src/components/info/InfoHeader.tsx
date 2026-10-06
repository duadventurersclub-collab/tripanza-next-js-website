import Link from "next/link";

export default function InfoHeader() {
  return (
    <header className="tp-info-header">
      <Link href="/" className="tp-info-brand" aria-label="Tripanza home">tripanza<span>.</span></Link>
      <nav aria-label="Company navigation">
        <Link href="/?tripanza_view=all#trips">Explore trips</Link>
        <Link href="/about">About us</Link>
        <Link href="/contact">Contact us</Link>
      </nav>
    </header>
  );
}
