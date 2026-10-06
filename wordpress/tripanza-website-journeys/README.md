# Website journeys (optional, disabled by default)

This addon records explicit WhatsApp follow-up choices from the Next.js login, itinerary download, and checkout flows. It uses WordPress MySQL for the queue and the **existing QR-linked CRM bot** for delivery. It does not start another QR session.

Install `tripanza-website-journeys.php` as a WordPress plugin, then set the same long random `TRIPANZA_JOURNEY_SECRET` in WordPress `wp-config.php` and the Next.js service environment. The website works without it; optional follow-up enrollment simply remains unavailable.

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

Important: signup verifies the phone with an OTP, but guest itinerary and checkout forms do not verify ownership of the entered phone. Their unchecked consent box and rate limits reduce accidental enrollment, but cannot prove that the person entering a third party's number owns it. Keep sending disabled until you decide whether to add phone verification or use an approved double-opt-in flow for those guest forms.
