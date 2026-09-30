// Snapshot the existing WordPress policy copy into the headless frontend.
// Run only when the sibling WordPress templates are available locally.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourceRoot = resolve(process.cwd(), "..");
const pages = {
  cancellation: ["page-cancellation-refund-policy.php", "refund"],
  cookies: ["page-cookie-policy.php", "cookie"],
  disclaimer: ["page-disclaimer.php", "disclaimer"],
  privacy: ["page-privacy-policy.php", "privacy"],
  terms: ["page-terms-conditions.php", "terms"],
};

const snapshot = {};
for (const [key, [filename, prefix]] of Object.entries(pages)) {
  const source = readFileSync(resolve(sourceRoot, filename), "utf8");
  const article = source.match(new RegExp(`<article class="${prefix}-content">([\\s\\S]*?)<\\/article>`));
  if (!article) throw new Error(`Policy content not found in ${filename}`);

  const sections = [...article[1].matchAll(/<section\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)].map((match) => {
    const title = match[2].match(/<h2>([\s\S]*?)<\/h2>/)?.[1];
    if (!title) throw new Error(`Section title missing in ${filename}: ${match[1]}`);
    const html = match[2]
      .replace(/href="<\?php echo esc_url\(home_url\('\/contact-us\/'\)\); \?>"/g, 'href="/contact"')
      .replace(/href="https:\/\/tripanza\.com\/cookies-policy\/"/g, 'href="/cookies-policy"')
      .replace(/href="https:\/\/tripanza\.com\/contact\/"/g, 'href="/contact"')
      .replace(/href="https:\/\/tripanza\.com\/"/g, 'href="/"');
    if (html.includes("<?php") || /<script\b/i.test(html)) throw new Error(`Unsafe template markup in ${filename}`);
    return { id: match[1], title: title.replace(/<[^>]*>/g, ""), html };
  });
  if (sections.length < 8) throw new Error(`Too few policy sections in ${filename}`);
  snapshot[key] = sections;
}

writeFileSync(resolve(process.cwd(), "src/content/legal-policy-snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
