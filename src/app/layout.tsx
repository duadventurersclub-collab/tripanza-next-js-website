import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import TripanzaBottomMenu from "@/components/navigation/TripanzaBottomMenu";
import NavigationProgress from "@/components/navigation/NavigationProgress";
import "./globals.css";
import "@/components/navigation/tripanza-bottom-menu.css";

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Suspense fallback={null}><NavigationProgress /></Suspense>
        {children}
        <TripanzaBottomMenu />
      </body>
    </html>
  );
}
