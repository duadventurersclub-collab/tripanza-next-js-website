import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure payment | Tripanza",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default function PaymentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
