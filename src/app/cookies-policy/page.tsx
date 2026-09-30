import type { Metadata } from "next";
import LegalPage from "@/components/info/LegalPage";

export const metadata: Metadata = { title: "Cookie Policy | Tripanza", description: "How Tripanza uses cookies and similar technologies, and how to manage them." };
export default function Page() { return <LegalPage policy="cookies" />; }
