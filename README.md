# Tripanza Next.js frontend

Next.js 16 frontend for Tripanza. Tour listings and detail pages are rendered from the WordPress `st_tours` post type.

## WhatsApp bot deployment

The [Tripanza WhatsApp bot](https://github.com/duadventurersclub-collab/tripanza-whatsapp-bot) is maintained and deployed from its separate repository. This repository contains the customer website and its WordPress integrations; it does not include the bot application or CRM workspace.

Deploy this repository's root to Vercel as a Next.js project. Keep `WORDPRESS_URL` pointed at the WordPress backend, and configure the WhatsApp notification plugin in WordPress with the separately hosted bot's URL and API key. CRM login and QR pairing are available on the bot's domain.

## Configuration

Copy `.env.example` to `.env.local` and set:

```env
WORDPRESS_URL=https://your-wordpress-site.example
NEXT_PUBLIC_SITE_NAME=Tripanza
NEXT_PUBLIC_SITE_URL=http://localhost:3000
REVALIDATION_SECRET=replace-with-a-long-random-secret
```

`NEXT_PUBLIC_WORDPRESS_URL` remains supported for older deployments, but `WORDPRESS_URL` is preferred because WordPress requests are made on the server.

## Supported WordPress routes

The tour data layer prefers the optimized headless routes:

- `GET /wp-json/tripanza-headless/v1/tours`
- `GET /wp-json/tripanza-headless/v1/tours/{slug}`

Native REST routes remain as a compatibility fallback:

- `GET /wp-json/wp/v2/st_tours?_embed=1`
- `GET /wp-json/wp/v2/st_tours?slug={slug}&_embed=1`
- `GET /wp-json/wp/v2/st_tours/{id}?_embed=1`

Native WordPress pagination totals are read from `X-WP-Total`. The custom endpoint may return either an array or an object containing `items`, `tours`, or `data` and `total`.

The adapter reads fields from the REST root, `meta`, `acf`, and `details`. It supports featured media, gallery URLs or attachment IDs, pricing, duration, locations, itinerary, stays, highlights, inclusions, exclusions, FAQs, departures, ratings, reels, partner details, and badges.

The collection route should contain lightweight card data. Full itinerary, gallery, FAQ, stay and departure data belongs only in the slug route. This prevents listing pages from downloading every complete tour document.

For native `st_tours`, custom fields must be registered with `show_in_rest => true`, or exposed through an ACF REST integration. Gallery attachment IDs are resolved through `wp/v2/media` automatically.

## WordPress cache revalidation

Plugin version 2.1.0 can notify Next.js whenever an `st_tours` post changes. Use the same long random secret in Render and WordPress. Add this to `wp-config.php`:

```php
define('TRIPANZA_NEXT_REVALIDATE_URL', 'https://tripanza-next-js-website.onrender.com/api/revalidate');
define('TRIPANZA_NEXT_REVALIDATE_SECRET', 'the-same-secret-used-in-render');
```

Public tour data has a five-minute fallback cache. The webhook expires the homepage, listing and affected detail page after a tour is saved or deleted.

Tour detail pages also use on-demand static HTML/ISR: the first uncached request generates the page, then subsequent requests reuse it. Cached tour data uses the admin-configured tour TTL (default 300 seconds); public layout settings revalidate every 60 seconds. Expired entries regenerate in the background. Fresh upstream reads use a cache-busting query so a stale WordPress CDN response cannot refill the Next.js cache after a purge.

The homepage uses the same on-demand HTML cache at `/` and sends a compact tour preview to the browser. Full itineraries, unused tour metadata and repeated reviews stay on tour detail pages. Tour edits and Site Controls cache purges invalidate the homepage. Public-cache OFF or either the tour/site cache TTL set to zero serves an uncached homepage at the same URL. Booking quotes and availability validation remain live.

Vercel functions are configured for the Mumbai (`bom1`) region in `vercel.json` to keep the server-side WordPress settings check near the site's main Indian audience. This setting does not change CDN delivery of static assets. Measure the deployed response after Vercel rebuilds; local tests do not predict network latency.

Site Controls 1.3.1 sends the same authenticated webhook when settings are saved or caches purged from WordPress. Next.js admin changes invalidate directly too. Tour maintenance/cache-mode checks have a maximum 10-second snapshot lifetime; public-cache OFF or tour TTL=0 selects a live renderer without changing the visible URL. Host/admin access and booking/payment API validation remain live. Private account data is never included in cached tour HTML.

Run `npm run build` then `node scripts/verify-tour-cache.mjs` for an isolated production-server test of cache hits, invalidation, cache-off, maintenance and live quote checks. This does not contact or modify production WordPress. Caching does not eliminate a hosting cold start after a free instance sleeps, nor the first uncached tour request.

## Development

```bash
npm install
npm run dev
```

Routes:

- `/` – featured tours
- `/tours` – searchable tour listing
- `/tours/[slug]` – complete tour detail
- `/booking?tour={id}` – booking flow
- `/admin/bookings` – native admin booking history
- `/admin/bookings/create` – native standard/custom booking manager (admin only)
- `/admin/bookings/{id}/edit` – native full booking editor (admin only)

Booking-history Edit buttons open the editor in a modal without changing the URL
or resetting filters, selection or scroll. Direct editor URLs still work.

The booking manager/editor requires Tripanza Native Admin API **v2.3.2** in WordPress.
Replace the older plugin using `tripanza-headless-admin-2.3.2.zip`; details and
live-integration smoke tests are in `wordpress/tripanza-headless-admin/README.md`.
Version 2.2.1 corrects history/editor balances for `complete`/`completed` orders
where only the advance was received. No booking metadata migration is needed.
Version 2.3.2 includes that balance fix and the native creation manager. Standard
creation calls the existing `tripanza_create_tour_booking` function; custom creation
uses private invoice tours with metadata copied from source post #27807. The source
post can be any WordPress post type; if absent, the new private tour uses the entered
details without copied metadata, as in the original manager. No embedded pages.

## Validation

```bash
npm run lint
npm run build
```
