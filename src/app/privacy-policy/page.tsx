import type { Metadata } from "next";
import LegalPage from "@/components/info/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy | Tripanza", description: "How Tripanza collects, uses, shares and protects personal information." };
export default function Page() { return <LegalPage policy="privacy" />; }
