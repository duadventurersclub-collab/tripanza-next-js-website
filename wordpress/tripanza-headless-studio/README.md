# Original Host Studio

This standalone WordPress plugin preserves the two original Tripanza templates
inside the authenticated Next.js Host experience. It depends on the active
Tripanza Headless Core API (including `tripanza-headless-host.php`), Traveler,
and the existing Tripanza PDF module for PDF tools and display settings.

## Install

Upload `tripanza-headless-studio.zip` in **WordPress → Plugins → Add New → Upload
Plugin**, then activate **Tripanza Original Host Studio Bridge**. Alternatively,
copy this directory to `wp-content/plugins/tripanza-headless-studio/` and activate
it. The `templates` directory must be uploaded with the main plugin file.

Deploy the accompanying Next.js changes. The browser remains on
`/poster-download` and `/add-your-own-trip`; no WordPress login cookie is needed.
The bridge authenticates each request with the existing bearer session stored
in the app's HTTP-only cookie. Private HTML responses are never cached.

## Preserved features

- All 22 poster styles and their entire original prompts, destination/season
  rules, saved offers, real upcoming dates, host details and storefront markup.
- Trip filtering, visible counts, prompt copying, ChatGPT generation, and POV
  persistence in WordPress user metadata (across devices).
- Trip Builder and My Trips tabs, create/edit, publication statuses, admin author
  filters/unpublish, and read-only canonical-trip copies.
- AI draft extraction from text, public websites, Google Drive, or PDF links.
  The existing OpenAI key remains in WordPress settings.
- Itinerary images, accommodation/amenities/galleries, FAQs, upgrade fee types,
  and all featured/PDF/gallery upload previews and removal controls.
- Departure calendar, sharing prices, owner payout previews, platform fees,
  seller commission, booking rules, deposits, categories and PDF/email settings.
- PDF design reset and tour cache clearing, restricted to authorized trip owners
  and administrators. Resale copies remain read-only for Hosts.

The original templates, CSS, prompt text and controllers are retained as PHP
sources. Changes are limited to app navigation/transport, nonce protection for
POV and PDF tools, the Host role check, and a guard for the My Trips tab.

The original screens run in an isolated document within Next.js. This is
intentional: it preserves their CSS and jQuery calendar without global selector
collisions. Links between app pages use Next.js navigation; form saves use AJAX.
