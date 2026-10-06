import { permanentRedirect } from "next/navigation";

// Old links and browser history remain valid without a separate tour-list page.
export default async function ToursPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const search = (await searchParams).search?.trim();
  const query = new URLSearchParams({ tripanza_view: "all" });
  if (search) query.set("search", search);
  permanentRedirect(`/?${query}#trips`);
}
