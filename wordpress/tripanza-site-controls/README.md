# Tripanza Site Controls

## Version 1.1.0 upgrade

Replace the existing Site Controls plugin using `tripanza-site-controls-1.1.0.zip`. Saved settings and Host state are preserved; new features default on, maintenance/announcements/email alerts default off. The frontend disables new editing controls until WordPress reports version 1.1.0. Nothing is enabled merely by opening the admin page. No footer is added.

New admin sections cover feature switches, maintenance, announcements, featured homepage tours, contact/WhatsApp/social links, health diagnostics, the last 100 admin actions (old/new settings), and grouped operational errors. Save applies all drafts together; changing a toggle alone does not persist it. Concurrent-edit revision conflicts require reload.

Feature switches are enforced at Next.js APIs and the related WordPress REST/PDF entry points. Reels includes discovery, trip videos and Host reel APIs. AI history deletion/privacy export remains accessible. Pausing new bookings also pauses AI asks because the assistant can create bookings. Existing orders, accounts, payment initiation and PayU/UPI verification are preserved. These controls do not claim to cover unrelated third-party booking plugins or their legacy endpoints.

Maintenance sends a sanitized custom HTTP 503 response with Retry-After on nonessential Next.js pages. The bypass is verified using WordPress manage_options, never a browser-supplied role. Admin, login/auth, accounts, existing booking/payment support, contact and legal routes stay accessible. New booking APIs pause for non-admins. Recovery is also available in WordPress Settings → Tripanza Site Controls. Maintenance is for the Next.js site, not the entire WordPress back office. Configuration-fetch outages preserve the existing traveller-site fallback, so maintenance is not an emergency security lockdown.

Content uses plain text, validated email/international numbers, HTTPS links (announcements also allow local paths), and up to 12 published tour slugs. Featured tours are placed first in the homepage collection in saved order. Social links appear on Contact. Default empty social URLs add no links. These settings don't rewrite legal policy text or third-party embedded studios.

Health is an on-demand check, not continuous monitoring: WP/PHP/Next versions, Tripanza plugin activation/versions, database SELECT 1, round-trip response latency, reported CDN cache status/age, and comparison of fixed/public/live/saved revisions. No cache hit ratios or entry counts are fabricated. Audit history is private to manage_options users, not a tamper-proof compliance archive. Legacy audit entries may not have field details.

### Optional private error monitoring setup

Configure the **same randomly generated secret of at least 32 characters** in both places:

- Next.js hosting environment: `TRIPANZA_MONITORING_SECRET` (server-only; never NEXT_PUBLIC).
- WordPress wp-config.php: `define('TRIPANZA_MONITORING_SECRET', 'the-same-private-secret');`.

Don't paste real secrets into commits, screenshots or support logs. Restart the Next.js service after changing its environment. Health reports presence only; matching must be verified on staging by inducing a known controlled error.

The HMAC-signed ingestion endpoint accepts only category + subsystem enums, with a 120-second timestamp window. No raw error text, stack, URL, header, IP, phone/email, booking token or customer input is stored. The server instrumentation reports uncaught server errors; critical booking/payment/chat/settings upstream failures are explicitly reported. Client-only JavaScript errors, every third-party plugin exception, and exact uptime are not covered. Error groups expire from views after 30 days and storage is pruned on ingestion (at most 100 groups); totals are operational best-effort, not accounting records. Email alerts default off, use the configured recipient or WP admin email, and are throttled site-wide to one attempt per 15 minutes. Mailer acceptance is not guaranteed inbox delivery; configure/test WordPress mail transport separately. Enabling alerts without the shared secret cannot collect Next.js errors.

Exclude `/wp-json/tripanza-headless/v1/monitoring/*` from CDN caching as well as the existing admin/settings/Host/auth/payment exclusions. Don't expose the monitoring secret through a public configuration route. No external monitoring account/provider is required.

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
