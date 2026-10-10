import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import TripanzaBottomMenu from "@/components/navigation/TripanzaBottomMenu";
import NavigationProgress from "@/components/navigation/NavigationProgress";
import SiteSettingsProvider from "@/components/settings/SiteSettingsProvider";
import { getPublicSiteSettings } from "@/lib/public-site-settings";
import SiteAnnouncement from "@/components/settings/SiteAnnouncement";
import CookieConsent from "@/components/settings/CookieConsent";
import CartReminder from "@/components/booking/CartReminder";
import { publicOrigin } from "@/lib/search-discovery";
import "./globals.css";
import "@/components/navigation/tripanza-bottom-menu.css";
import "@/components/info/info-pages.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSiteSettings();
  const origin = publicOrigin(settings.seo_site_url);
  return {
    metadataBase: origin ? new URL(origin) : undefined,
    title: { default: "Tripanza | Curated Group Trips in India", template: "%s | Tripanza" },
    description: "Explore curated group trips, itineraries, upcoming departures and travel experiences with Tripanza.",
    applicationName: "Tripanza",
    verification: settings.google_site_verification ? { google: settings.google_site_verification } : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getPublicSiteSettings();
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Suspense fallback={null}><NavigationProgress /></Suspense>
        <SiteSettingsProvider initial={settings}>
          <SiteAnnouncement />
          {children}
          <TripanzaBottomMenu />
          <CartReminder />
          <CookieConsent />
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
