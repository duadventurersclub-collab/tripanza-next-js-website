import type { Metadata } from "next";
import LegalPage from "@/components/info/LegalPage";

export const metadata: Metadata = { title: "Disclaimer | Tripanza", description: "Important information about Tripanza travel content, services and third-party providers." };
export default function Page() { return <LegalPage policy="disclaimer" />; }
