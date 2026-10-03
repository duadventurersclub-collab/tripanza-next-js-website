import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import TripanzaBottomMenu from "@/components/navigation/TripanzaBottomMenu";
import NavigationProgress from "@/components/navigation/NavigationProgress";
import SiteSettingsProvider from "@/components/settings/SiteSettingsProvider";
import { getSiteSettings } from "@/lib/site-settings";
import SiteAnnouncement from "@/components/settings/SiteAnnouncement";
import "./globals.css";
import "@/components/navigation/tripanza-bottom-menu.css";
import "@/components/info/info-pages.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tripanza",
  description: "Ultra-fast travel website powered by WordPress backend and Next.js frontend",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Suspense fallback={null}><NavigationProgress /></Suspense>
        <SiteSettingsProvider initial={settings}>
          <SiteAnnouncement />
          {children}
          <TripanzaBottomMenu />
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
