import type { Metadata } from "next";
import LegalPage from "@/components/info/LegalPage";

export const metadata: Metadata = { title: "Cancellation and Refund Policy | Tripanza", description: "Tripanza cancellation charges, refund process, booking changes and package-specific terms." };
export default function Page() { return <LegalPage policy="cancellation" />; }
