import { Inter } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export default function TourDetailLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={inter.variable}>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />
      {children}
    </div>
  );
}
