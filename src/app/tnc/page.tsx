import type { Metadata } from "next";
import LegalPage from "@/components/info/LegalPage";
import { publicPageMetadata } from "@/lib/search-discovery";

export const generateMetadata = (): Promise<Metadata> => publicPageMetadata("/tnc", "Terms and Conditions", "Tripanza booking, payment, cancellation and participation terms and conditions.");
export default function Page() { return <LegalPage policy="terms" />; }
