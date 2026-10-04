import type { Metadata } from "next";
import LegalPage from "@/components/info/LegalPage";
import { publicPageMetadata } from "@/lib/search-discovery";

export const generateMetadata = (): Promise<Metadata> => publicPageMetadata("/privacy-policy", "Privacy Policy", "How Tripanza collects, uses, shares and protects personal information.");
export default function Page() { return <LegalPage policy="privacy" />; }
