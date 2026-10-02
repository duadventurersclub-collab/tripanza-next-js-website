# Tripanza Site Controls

Install this plugin **before deploying the new Next.js frontend**. Upload `tripanza-site-controls.zip` through WordPress → Plugins → Add New → Upload Plugin and activate it alongside the existing Tripanza Headless Core and Original Host Studio Bridge.

## Admin access

- Next.js: `/admin/settings` (`/admin` redirects here). Sign in using an account with WordPress `manage_options` capability.
- WordPress fallback: Settings → Tripanza Site Controls. The same saved settings are used by both interfaces. This remains accessible with Host turned off.
- Next.js forwards the HTTP-only session token server-side; it does not expose credentials to browser code.
- REST writes require administrator permission. Next.js writes also verify request origin; the WordPress form verifies a nonce.
- Defaults preserve existing cache lifetimes and enable Host. If config is missing/unreachable, the frontend fails closed for Host but traveller pages continue working.

## Cache coverage

Public tour data/gallery queries, standalone departure availability snapshots, discovery reels, Host landing data, site metadata, the WordPress Host leaderboard, per-session server booking history, and per-tab browser account previews have adjustable lifetimes. Zero disables the selected cache; turning public caching off also bypasses the leaderboard transient. Live Host profile requests remain uncached regardless of these settings. Booking quotes and order creation always recheck current prices/availability server-side.

Saving settings rotates an app cache revision, so changes made through the WordPress fallback also bypass old cached responses. The Next.js settings page additionally invalidates data tags and page output. Manual per-group refresh actions expire tagged data; the all-app action also rotates server/browser cache identity. It does **not** clear PDFs or unrelated WordPress state.

Browser settings refresh on navigation, focus and every 30 seconds. Existing tabs cannot be forcibly emptied from the server; their cache generation changes on the next settings check. Booking caches are per session and expire on the next request after revision change. Authentication, OTPs, checkout, payments, private Host APIs and studio documents stay uncached.

PDF clearing uses `tripanza_clear_post_pdf_cache()` from the installed PDF module, restricted to tour IDs. All-tour clearing uses 20-tour batches; a partial failure reports progress. The module is responsible for its own filesystem safety. No direct recursive file deletion is implemented here.

WordPress page-cache purge integrates with installed LiteSpeed, WP Rocket and W3 Total Cache. Toggling Host also requests a supported page-cache purge. Unsupported CDN/provider caches and other plugins' settings must be managed in their own dashboards. No blanket object-cache flush or deletion of authentication/payment transients is performed.

## Host switch

Disabled Host blocks all `/tripanza-headless/v1/host` routes (including registration and public profile confirmation), Next.js Host pages and APIs, the original studio bridge, native WordPress Host pages/templates/profile query variables, and the known legacy Host reel AJAX actions. There is no administrator bypass on these Host routes. Admin controls and traveller booking/account APIs remain available.

Existing hosts, commissions, trips and bookings are not removed or automatically unpublished. Existing published trips remain bookable as traveller trips. The switch does not cancel bookings or change payout obligations.

**Deployment cache rules:** Exclude `/wp-json/tripanza-headless/v1/settings/*`, `/wp-json/tripanza-headless/v1/admin/*`, `/wp-json/tripanza-headless/v1/host*`, Host pages and `?tripanza_host_studio=*` from upstream full-page/CDN caching. PHP cannot enforce a switch if a CDN serves a previously cached page without reaching WordPress. Purge any external CDN caches at installation; supported WordPress cache purges cannot guarantee every external provider was cleared.

## Verification

On Windows, build installable ZIPs using `powershell -File scripts/package-site-controls.ps1 -OutputPath <new-zip-path>` from the repository root. The script uses standard forward-slash ZIP entry paths and verifies that the PHP plugin file is directly inside `tripanza-site-controls/`. Do not use `Compress-Archive` for deployment packages with Windows backslash entry paths.

After activation, confirm both Settings → Tripanza Site Controls and `/wp-json/tripanza-headless/v1/settings/public` are available. If both are missing, inspect the Installed Plugins entry (exact name, version, activation state, and any recovery-mode warning) before treating it as a frontend cache problem.

- `npm run build`
- `node scripts/verify-site-controls.mjs` (mock WordPress + real Next.js production server/browser)
- `node scripts/verify-host-studio.mjs`

The regression scripts use optional `php-parser` and Playwright modules in the same temporary validation directory as the original studio script. No runtime application dependency is added. Production WordPress integration still needs an installed-plugin smoke test on staging/live.
