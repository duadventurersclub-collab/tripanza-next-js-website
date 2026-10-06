import HomeClient from "@/app/HomeClient";
import { getHomepageData } from "@/lib/homepage-data";
import { getPublicSiteSettings } from "@/lib/public-site-settings";
import { getSiteSettings } from "@/lib/site-settings";
import { publicOrigin, publicUrl, safeJsonLd } from "@/lib/search-discovery";
import "@/app/home.css";

export default async function HomePage({ live = false }: { live?: boolean }) {
  const [data, settings] = await Promise.all([
    getHomepageData(live),
    live ? getSiteSettings() : getPublicSiteSettings(),
  ]);
  const origin = publicOrigin(settings.seo_site_url);
  return <>
    {origin && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({
      "@context": "https://schema.org", "@graph": [
        { "@type": "Organization", "@id": `${origin}/#organization`, name: "Tripanza", url: origin },
        { "@type": "WebSite", "@id": `${origin}/#website`, name: "Tripanza", url: publicUrl(origin, "/"), publisher: { "@id": `${origin}/#organization` } },
      ],
    }) }} />}
    <HomeClient siteName={data.site.name} tours={data.tours} />
  </>;
}
