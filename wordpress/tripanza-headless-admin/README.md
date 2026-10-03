# Tripanza Native Admin API v2.1.0

The `/admin` dashboard and menu are React/Next.js components. This plugin provides
protected JSON data/actions only. No iframe, remote PHP page, theme rendering,
jQuery, Chart.js CDN, Flatpickr CDN, or HTML bridge is used by the admin dashboard.
The original dashboard styling, widgets, filters, nine AI presets and menu entries
are preserved. Calendar and revenue chart are native React components.

## Install/update

Install `tripanza-headless-admin-2.1.0.zip` in WordPress, replacing v2.0.0 (or v1.0.0) of the
Original Admin Dashboard Bridge if installed. The plugin directory is unchanged,
so WordPress can upgrade it. Activate alongside Headless Core and Site Controls.
Nothing is migrated or deleted: existing `tripanza_admin_todos`,
`tripanza_future_trips`, and `tripanza_holiday_opportunities` options are reused.
Keep Traveler and the existing Tripanza itinerary/PDF modules active.

- Only users with `manage_options` may access `/admin/workspace` or `/admin/identity`.
  The Next app forwards the HttpOnly login session on the server, never in HTML.
  Guests/non-admins visiting `/admin` and `/admin/settings` redirect home.
- GET is private/no-store; POST requires same-origin browser access, a WP admin
  session, a user-bound nonce, allowlisted action and validated input. The API uses
  a short write lock for shared options. Task deletion is author-only, as originally.
- Tasks/plans save over AJAX without page reload. Task completion is optimistic
  and rolls back on error. Adds have per-request idempotency keys; email is never
  automatically retried. Filters/search/calendar/menu updates are local.
- Analytics retain Traveler's original pricing/status rules, exclude archived
  bookings and retain the original 1,000-row limit. Cards filter by departure
  month/year. The chart always compares the current and preceding year.
- AI presets retain the original prompt/model and use WordPress's existing
  `whatsapp_ai_openai_api_key`. They run only on explicit admin clicks. These are
  planning suggestions, not verified holiday or university calendars.
- Email uses the existing itinerary HTML builder and original mail/CRM logic.
  The API reports a CRM insert failure instead of claiming it was saved.
  PDF downloads still use the installed WordPress PDF generator in a new tab.
- Font Awesome retains the reference menu/dashboard icons. Chart/calendar need
  no external scripts. Dashboard is independent of the Host feature switch.
- Scope includes the dashboard/menu and native global booking history at
  `/admin/bookings`. `/global-booking-history-for-admins` redirects there.
  Separate CRM, finance, sales and Host
  management pages remain WordPress links and may need WordPress login.
  Add Trips/Poster Download point to their existing Next.js routes/studios; those
  separate pages are not rebuilt by this change.

## Native booking history

- All four original presentation layers are scoped to the booking page. Charts
  use bundled Chart.js, not a CDN. PDF exports use lazy-loaded jsPDF/AutoTable;
  private records are not sent to an external export service.
- Protected `/admin/bookings` GET/POST REST endpoints supply JSON only. The
  existing identity/workspace API contract remains v2.0.0 for compatibility.
- Only administrators can see the page; guests and non-admins redirect home.
  POST additionally requires a user-bound booking nonce and allowlisted action.
- Local source/status/trip/customer/departure filters, columns, keyboard/pointer
  resize, selection, totals, two-year revenue/gender charts, native details drawer,
  PDF notes, and explicit coordinator WhatsApp drafts are supported. Only column
  widths/visibility are stored locally, never traveller records or phone numbers.
- Each page loads up to the original 1,000 records, with visible pagination.
  Filters, analytics and reports cover the loaded page, not an undisclosed full
  database scan. Archived orders have independent page totals.
- Status changes retain the original explicit status/mail behavior. Resend never
  auto-retries. An email warning is shown if the booking saved but mailing failed.
  Traveler's tax/coupon/deposit/booking-fee/adjustment formula is preserved.
- Per-booking write locks and revision checks reject stale status/adjustment writes.
  Archive keeps records. Restore brings them back. Permanent deletion requires
  typing `DELETE PERMANENTLY` and the backend verifies the booking is archived.
  The old seven-click UI unlock is replaced by visible admin-only controls and
  explicit confirmation, not treated as a security boundary.
- Existing `st_order` normal bookings are writable. Legacy WooCommerce rows are
  read-only here: use the existing full editor to preserve their lifecycle.
  The separate full booking editor and invoice generator remain ordinary links;
  neither is embedded. WordPress login may be needed for those separate tools.

Exclude `/wp-json/tripanza-headless/v1/admin/*` from CDN cache rules that ignore
Cache-Control. Requests include a fresh cache-busting identifier. Do not deploy
the obsolete v1.0.0 bridge package with this native frontend.

## Verification

Run `npm run build`, `node scripts/verify-admin-dashboard.mjs`, and
`node scripts/verify-site-controls.mjs`. Test tooling uses the optional temporary
node_modules folder documented by `verify-host-studio.mjs`. Fixture tests check
native DOM, all dashboard controls, API transport, rollback, mobile layout,
permissions and PHP 7.4 syntax. They do not execute WordPress or send live mail/AI.

After updating the plugin, smoke-test actual Traveler figures, a temporary task
and plan, PDF download, mail to your own inbox, and one AI preset. Confirm existing
data remains visible. Actual production modules/configuration need this final check.

Also run `node scripts/verify-admin-bookings.mjs`. These fixture checks do not
execute a real WordPress database or send production emails/WhatsApp messages.
After installing v2.1.0, compare a known booking's amounts with the original page
and smoke-test status/email/adjustment on a temporary booking. Do not test purge
on a real customer record. Existing order metadata is reused without migration.

Package: `powershell -NoProfile -ExecutionPolicy Bypass -File
scripts/package-admin-dashboard.ps1 -OutputPath <new-path.zip>`.
