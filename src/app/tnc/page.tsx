import type { Metadata } from "next";
import LegalPage from "@/components/info/LegalPage";

export const metadata: Metadata = { title: "Terms and Conditions | Tripanza", description: "Tripanza booking, payment, cancellation and participation terms and conditions." };
export default function Page() { return <LegalPage policy="terms" />; }
