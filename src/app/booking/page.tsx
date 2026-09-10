import { notFound } from "next/navigation";
import { getTourById } from "@/lib/wp";
import type { Metadata } from "next";
import BookingEngine from "@/components/booking/BookingEngine";

export const dynamic = "force-dynamic";

interface BookingPageProps {
  searchParams: Promise<{ tour?: string; date?: string }>;
}

export async function generateMetadata({ searchParams }: BookingPageProps): Promise<Metadata> {
  const { tour } = await searchParams;
  if (!tour) return { title: "Booking | Tripanza" };
  
  try {
    const tourData = await getTourById(Number(tour));
    if (!tourData) return { title: "Booking | Tripanza" };
    return {
      title: `Book ${tourData.title} | Tripanza`,
    };
  } catch {
    return { title: "Booking | Tripanza" };
  }
}

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const { tour: tourIdStr, date: dateStr } = await searchParams;

  if (!tourIdStr) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-3xl font-black text-slate-900">Missing Tour Information</h1>
        <p className="mt-4 text-slate-600">Please select a tour and departure date to book.</p>
      </main>
    );
  }

  const tour = await getTourById(Number(tourIdStr));

  if (!tour) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            Secure Checkout
          </h1>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-7xl px-6">
        <BookingEngine tour={tour} dateStr={dateStr || null} />
      </div>
    </main>
  );
}
