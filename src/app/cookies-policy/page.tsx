import type { Metadata } from "next";
import LegalPage from "@/components/info/LegalPage";
import { publicPageMetadata } from "@/lib/search-discovery";

export const generateMetadata = (): Promise<Metadata> => publicPageMetadata("/cookies-policy", "Cookie Policy", "How Tripanza uses cookies and similar technologies, and how to manage them.");
export default function Page() { return <LegalPage policy="cookies" />; }
