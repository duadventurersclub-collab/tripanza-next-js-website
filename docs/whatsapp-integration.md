# Integrated WhatsApp bot (staged, off by default)

The Next.js repository now contains a native administrator dashboard at `/admin/whatsapp` and an opt-in, single-process Node server with the two Baileys connections. The original `../whatsapp-bot` folder is not modified. The deployed `render.yaml` still starts normal `next start`, so installing this code does **not** connect either phone or change the existing bot.

The notifications connection only sends messages. The CRM connection receives customer messages, forwards them to the existing `whatsapp-ai/v1/server-reply/` WordPress endpoint, sends its text/interactive replies and media, and records human replies there. WordPress still owns AI replies, lead history and follow-up rules in this phase. The outbound `/api/send` contract remains API-key protected and accepts `phone`, `message`, optional `bot: "crm"`, and `api_key`.

## Before activation

1. Use one always-on Render **paid** web-service instance with a persistent disk. Render Free spins down and cannot provide a persistent disk. Do not scale this service above one instance while a WhatsApp number is attached.
2. Mount a private disk and choose an absolute folder inside it, for example `/var/data/tripanza-whatsapp`. The two session folders will be `auth_notifications` and `auth_crm` beneath it. Restrict access to administrators; never put these files in Git, public assets or logs. Back them up securely.
3. Configure the same webhook secret in WordPress (`TRIPANZA_WHATSAPP_WEBHOOK_SECRET`) and this Node service (`WP_WEBHOOK_SECRET`). The WordPress webhook must reject requests without that secret before cutover.
4. Set the following server-only environment variables; never use `NEXT_PUBLIC_` for secrets:

   - `TRIPANZA_WHATSAPP_ENABLED=true`
   - `TRIPANZA_WHATSAPP_AUTH_DIR=/var/data/tripanza-whatsapp`
   - `TRIPANZA_WHATSAPP_PERSISTENT_STORAGE_CONFIRMED=yes` (set only after verifying the disk mount)
   - `TRIPANZA_WHATSAPP_API_KEY=<long random outbound API key>`
   - `WP_WEBHOOK_SECRET=<same secret as WordPress>`
   - `TRIPANZA_WHATSAPP_CRM_WEBHOOK_URL=https://tripanza.com/wp-json/whatsapp-ai/v1/server-reply/` (optional; shown default)
   - `ENABLE_NATIVE_LINK_CTA=true` only if phone-only native link buttons are desired; by default plain links work across WhatsApp clients.

5. Build normally (`npm run build`) and change the Render start command to `npm run start:whatsapp` **only for a controlled cutover**. Do not run this alongside another instance connected to the same numbers. Leave `render.yaml` untouched until that decision.
6. Move the old session folders to the new disk through a secure channel if available, or use `/admin/whatsapp` to scan new QR codes. Do not copy credentials into the repository. Pairing a phone can disconnect the old process; schedule the switch and verify one number at a time.
7. After both connections are stable, update **both** WordPress outbound configurations to target the Next.js domain's `/api/send` with the same new API key: the core OTP sender uses `TRIPANZA_WHATSAPP_BOT_URL` / `TRIPANZA_WHATSAPP_API_KEY` (or `tz_wa_bot_url` / `tz_wa_api_key`), while CRM follow-ups use `TRIPANZA_WHATSAPP_BOT_URL` / `TRIPANZA_WHATSAPP_BOT_API_KEY` (or `tripanza_whatsapp_bot_url` / `tripanza_whatsapp_bot_api_key`). If the shared URL constant is set, it covers both URLs, but the API-key constants remain distinct. Test OTP, booking notices, CRM replies, human replies, PDF, reels, hotel images, follow-up messages, reconnection and redeploy persistence. Only then retire the old bot. Keep a rollback path to its original URL/service.

The administrator QR/status endpoints check the same WordPress administrator session used by the Next.js admin pages and send `private, no-store` responses. If WordPress identity verification fails, QR and status fail closed. The old bot's unauthenticated QR pages are not reproduced; legacy QR paths redirect to the private admin dashboard.

## Verification

- `node scripts/verify-whatsapp-integration.mjs` tests the HTTP access boundary without connecting to WhatsApp.
- `npm run build` and `npm run lint` check the Next.js application.
- `TRIPANZA_WHATSAPP_ENABLED` is **off** by default, including under `npm run start:whatsapp` until deliberately set.
- Real WhatsApp send/receive, QR pairing, WordPress CRM response parity, credential persistence and cutover require a staging/live test with the actual numbers. Automated tests cannot establish that those external flows work.
