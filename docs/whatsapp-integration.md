# Integrated WhatsApp bot (Free-mode rollout)

The Next.js service now starts the custom server with `npm run start:whatsapp`. This serves the website even when the WhatsApp engine is not configured. The engine remains **off by default**; changing the start command alone does not disconnect the original `../whatsapp-bot` service or pair a number. The original bot folder is untouched.

The notifications connection sends outbound messages. The CRM connection sends and receives, forwards incoming messages to the existing WordPress `whatsapp-ai/v1/server-reply/` endpoint, and sends WordPress's replies and media. WordPress still owns AI, CRM history, and follow-ups. The outbound `/api/send` contract remains protected by `api_key` and accepts `phone`, `message`, and optional `bot: "crm"`.

## Activate on Render Free

1. Deploy the new `render.yaml` start command. If the service was created manually rather than as a Blueprint, set its start command in Render to `npm run start:whatsapp` too. Confirm the website still works and `/admin/whatsapp` says the engine is disabled.
2. In the Render service's **Environment** settings, add a long random `TRIPANZA_WHATSAPP_API_KEY` and `WP_WEBHOOK_SECRET`. Configure that same webhook secret in WordPress as `TRIPANZA_WHATSAPP_WEBHOOK_SECRET`; the WordPress webhook must reject requests without it. Do not put either value in Git, a `NEXT_PUBLIC_` variable, a URL, or a screenshot. The optional CRM webhook URL defaults to `https://tripanza.com/wp-json/whatsapp-ai/v1/server-reply/`.
3. The Blueprint sets `TRIPANZA_WHATSAPP_AUTH_DIR=/tmp/tripanza-whatsapp`, `TRIPANZA_WHATSAPP_ALLOW_EPHEMERAL_AUTH=yes`, and `TRIPANZA_WHATSAPP_KEEP_AWAKE=true`. If the service is not Blueprint-managed, set these three variables in Render's Environment settings. Only after they and the secrets are in place, set `TRIPANZA_WHATSAPP_ENABLED=true` and redeploy.
4. Open `/admin/whatsapp` while signed in as a WordPress administrator. Scan each number's QR code. Pairing the new CRM/notifications connection may disconnect the old one. Once both are connected, stop the old bot service so it does not keep consuming the same Render workspace's Free instance-hours.
5. Switch **both** WordPress outbound configurations to the Next.js domain and the new API key. Core OTP uses `TRIPANZA_WHATSAPP_BOT_URL` / `TRIPANZA_WHATSAPP_API_KEY` (or `tz_wa_bot_url` / `tz_wa_api_key`). CRM follow-ups use `TRIPANZA_WHATSAPP_BOT_URL` / `TRIPANZA_WHATSAPP_BOT_API_KEY` (or `tripanza_whatsapp_bot_url` / `tripanza_whatsapp_bot_api_key`). Both URLs should be the origin, not the `/api/send` path. Test OTP, booking notices, inbound replies, human replies, PDF, reels, photos, follow-ups, and reconnection before relying on the new service.

The Free-mode timer requests the service's own public Render URL every ten minutes, like the original bot. It starts **only when the bot engine starts successfully**. It may reduce idle spin-down but cannot restart an already sleeping or suspended service. Render Free can restart at any time, stores files only temporarily, and has a shared 750-hour monthly workspace limit. Every restart, sleep, or deploy can erase the WhatsApp sessions and require QR re-pairing. This is not reliable enough for guaranteed OTP or booking notifications. Monitor both connections and leave a manual fallback available.

If any required value is missing or the auth folder cannot be created, the bot fails closed while the website keeps running. The admin dashboard reports the setup problem. The administrator QR/status endpoints verify the WordPress admin session and return `private, no-store`; the old public QR pages redirect to the private dashboard.

## Later upgrade to persistent hosting

On a paid always-on service, attach a private persistent disk, move `TRIPANZA_WHATSAPP_AUTH_DIR` inside its mount, set `TRIPANZA_WHATSAPP_PERSISTENT_STORAGE_CONFIRMED=yes`, and remove `TRIPANZA_WHATSAPP_ALLOW_EPHEMERAL_AUTH` and the keep-awake setting. Never commit WhatsApp session files. A single instance must own the paired numbers.

## Verification

- `node scripts/verify-whatsapp-integration.mjs` tests private status/QR access and the outbound API without contacting WhatsApp.
- `npm run build` and `npm run lint` check the Next.js application.
- Live QR pairing, message delivery, WordPress webhook security, and restart behavior require a controlled test with the actual numbers. Automated tests cannot prove those external flows work.
