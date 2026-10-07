# Website journeys (optional, disabled by default)

This addon records explicit WhatsApp follow-up choices from both websites. Next.js sends its signup, itinerary, tour-view, cart and checkout events through the signed REST route. On WordPress, the addon adds an unchecked choice to the two known itinerary-PDF forms and the custom Traveler checkout. For the live Tripanza WhatsApp OTP form, it records the choice only after `sol_verify_otp` succeeds and the authenticated phone matches the account. It also supports other registration forms that submit `tpj_followups=1` and fire `user_register`. It uses WordPress MySQL for the queue and the **existing QR-linked CRM bot** for delivery. It does not start another QR session.

The choice is now remembered instead of being requested again at every form. Guests receive a 90-day, HttpOnly, first-party `tripanza_journey` cookie containing only a random visitor ID; the phone, consent time and source remain in WordPress. A guest's saved choice works across forms on that same site. Cookies cannot be shared between `tripanza.com` and a separate `vercel.app` domain. Once signed in with a verified number, a saved choice can be reused across both websites via the account phone. The form shows a Turn off action for a saved choice, and message STOP links remain available. Neither an unknown guest nor a logged-in user is opted in by default.

Install `tripanza-website-journeys.php` as a WordPress plugin, then set the same long random `TRIPANZA_JOURNEY_SECRET` in WordPress `wp-config.php` and the Next.js service environment. The website works without it; optional follow-up enrollment simply remains unavailable.

Update the installed WordPress plugin from the new ZIP, not only the Next.js deployment. WordPress has its own public AJAX endpoint with a nonce; its frontend never receives the shared server-to-server secret. The local `simple-otp-login-ajax.php` verifies the WhatsApp OTP and starts a WordPress session; test the deployed version in staging, including the legacy-account phone-proof path. For other registration forms, the inserted `tpj_followups=1` field and a phone number in `st_phone`, `billing_phone`, or `phone` must reach `user_register`. Phone fields edited by administrators or in an account profile do not create marketing consent.

Before sending anything, configure these **server-only** WordPress constants and verify the bot's CRM number, API key, and `/healthz` are working:

```php
define('TRIPANZA_JOURNEY_SECRET', 'replace-with-a-long-random-value');
define('TRIPANZA_WHATSAPP_BOT_URL', 'https://your-existing-bot.example.com');
define('TRIPANZA_WHATSAPP_API_KEY', 'replace-with-the-existing-bot-api-key');
define('TRIPANZA_NEXT_APP_URL', 'https://your-nextjs-site.example.com');
// Only after consent, opt-out, delivery and booking-stop tests:
define('TRIPANZA_JOURNEY_SEND_ENABLED', true);
```

Until that final switch is explicitly set, **nothing is sent**. The PDF and checkout are not dependent on the bot. The addon schedules one itinerary reminder after six hours or one cart/checkout reminder after one hour, during WordPress-site-timezone 10:00–19:00 only. It suppresses messages after a booking, a withdrawal/opt-out, a CRM unsubscribe, or two lifetime messages for the same phone; it also spaces sends by at least a day. Every outbound message includes a signed opt-out link. The queue is processed by WP-Cron, so due times can slip on low-traffic sites unless you run a real cron calling `wp-cron.php`.

This is a technical integration, **not a claim of WhatsApp-policy or legal compliance**. A QR-linked/unofficial sender is not the official WhatsApp Business Platform; business-initiated marketing via the official platform uses approved templates and pricing. Review your opt-in wording, privacy notice, delivery method and applicable law before enabling sends. Never commit keys or tokens.

Important: the Next.js phone signup verifies the number with an OTP. The guest itinerary and checkout forms do not verify ownership, and the WordPress registration plugin's verification behavior must be checked separately. Their unchecked consent box and rate limits reduce accidental enrollment, but cannot prove that a guest entering a third party's number owns it. Keep sending disabled until you decide whether to add phone verification or use an approved double-opt-in flow for those guest forms.

The WordPress site's Privacy and Cookie Policy pages are managed separately from the Next.js pages. Update their disclosures for the optional first-party journey cookie, consent record, tour/checkout interest and WhatsApp follow-ups before enabling sends.
