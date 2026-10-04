import type { Metadata } from "next";
import LegalPage from "@/components/info/LegalPage";
import { publicPageMetadata } from "@/lib/search-discovery";

export const generateMetadata = (): Promise<Metadata> => publicPageMetadata("/cancellation-policy", "Cancellation and Refund Policy", "Tripanza cancellation charges, refund process, booking changes and package-specific terms.");
export default function Page() { return <LegalPage policy="cancellation" />; }
