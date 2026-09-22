# Tripanza Next.js frontend

Next.js 16 frontend for Tripanza. Tour listings and detail pages are rendered from the WordPress `st_tours` post type.

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

## Validation

```bash
npm run lint
npm run build
```
