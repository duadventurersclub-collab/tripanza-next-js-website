import type { Metadata } from "next";
import LegalPage from "@/components/info/LegalPage";
import { publicPageMetadata } from "@/lib/search-discovery";

export const generateMetadata = (): Promise<Metadata> => publicPageMetadata("/disclaimer", "Disclaimer", "Important information about Tripanza travel content, services and third-party providers.");
export default function Page() { return <LegalPage policy="disclaimer" />; }
