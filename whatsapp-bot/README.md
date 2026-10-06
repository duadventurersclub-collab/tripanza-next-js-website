# Tripanza WhatsApp bots and team workspace

The original notifications/OTP bot, CRM number, dashboard, QR pages, and
`POST /api/send` remain available. The team workspace adds the features adapted
from [WA-AKG-business](https://github.com/mrifqidaffaaditya/WA-AKG-business).

## Run

Requires Node.js 22.18 or newer (22 or 24), with built-in SQLite.

```sh
npm ci
npm start
```

`npm ci` and `npm install` automatically install and build the workspace through
the root `postinstall` script, including when `NODE_ENV=production`. Build
failures stop deployment instead of silently leaving the workspace unavailable.
After source edits, run `npm run build` again.

## Render deployment

For the existing Node service, use **Build Command** `npm ci` and **Start Command**
`npm start` (or keep `node bot.js`). Then choose **Deploy latest commit**. The repo's
`.node-version` selects Node 22.22.0. If the service has a `NODE_VERSION` environment
variable, it overrides this file; use 22.22.0 or a supported Node 24 release.
Do not set `NPM_CONFIG_IGNORE_SCRIPTS=true`, because it disables the workspace build.

The build log should end with `[workspace] Deployment build complete.` and the
runtime log should show `[workspace] Ready at /workspace.`. Set
`BUSINESS_ADMIN_EMAIL` and `BUSINESS_ADMIN_PASSWORD` (12+ characters) before the
first startup so you have a known sign-in on Render. Set `AI_API_KEY` for AI replies.
Use a persistent disk for `BUSINESS_DATA_DIR` to retain users and chat history.
For Docker services, the root Dockerfile performs the same installation and build.

Set the Render **Health Check Path** to `/healthz`. It returns 503 promptly while
the enabled workspace is starting or unavailable, and 200 when the workspace
has prepared its backend and production frontend. WhatsApp pairing and external
AI/website availability do not block this readiness check. `/api/health` checks
the workspace database after startup. A health check does not keep a free service
awake or prevent a process from running out of memory.

The HTTP server binds to `0.0.0.0:$PORT`, uses a 120-second keep-alive timeout,
and catches rejected page/QR handlers instead of letting them terminate the
process. Oversized outbound API bodies stop buffering after 64 KiB. Workspace
requests receive an immediate 503 during startup rather than waiting indefinitely.
These protections address code-level connection resets; a recurring Render 502
still needs runtime logs around the failure to distinguish a restart, memory
limit, startup problem or proxy timeout. Check Render's **Logs**, **Events** and
memory metrics. Do not share keys, passwords or customer message bodies.

Memory readings appear as `[memory] startup`, `[memory] workspace-ready`, and
once a minute afterwards. `rss` is total process memory, `heapLimit` is Node's
JavaScript heap ceiling, and `containerLimit` is the detected hosting limit (or
`unknown`). A V8 allocation stack followed by a restart suggests heap exhaustion;
the preceding `FATAL ERROR` line confirms the cause. Compare these figures with
Render's memory graph and instance capacity before changing `NODE_OPTIONS`.
Increasing the heap beyond available instance RAM can cause another restart.
The workspace and both WhatsApp connections share this process.

## First sign-in

Copy `.env.example` to `.env` to configure the provider and optional integrations.
Open the dashboard on port 3000 and choose **Open team workspace**. The workspace
is at `/workspace`; sign in at `/login`. First-run administrator credentials are
stored privately in `business/data/credentials.json`, or supply
`BUSINESS_ADMIN_EMAIL` and `BUSINESS_ADMIN_PASSWORD` before first startup.
Create other administrators and agents in **Team members**. Change the initial
password in account settings. Credentials and WhatsApp sessions are git-ignored.

The workspace uses the existing CRM socket and its QR pairing. It does not create
another WhatsApp connection or change the notifications bot.

## Features

- AI assistant: configurable persona, system prompt, business information,
  handoff keywords, provider/model settings, business-hours context, stock data,
  and returning-customer context.
- Human handoff via `#chatcs`, configured keywords, or the assistant's tool call.
  When the provider is unavailable or no key is set, the customer enters the queue.
- Waiting queue, first-claim ownership, My Chats/All Chats, transfer, hold/resume,
  resolve, resolution notes, session timeouts, full history, and cursor pagination.
- Text and quoted replies; image, video, and document uploads up to 10 MB;
  drag-and-drop uploads, signatures, quick replies, and configurable automatic
  claim/resolve replies.
- Customer ratings, returning-customer badges, session summaries, live dashboard
  statistics, per-agent performance, user management, and audit logs.
- Socket.io updates, claim popups, sound alerts, browser notifications, web push,
  per-user notification preferences, and optional WhatsApp group activity alerts.
- Google Sheets service-account integration and MySQL/PostgreSQL stock sources,
  configurable column mapping and stock refresh interval.
- Password hashing, administrator/agent roles, httpOnly session cookies, refresh
  rotation, logout revocation, login rate limits, protected media, and auth guards.
- Separate responsive workspace with Tripanza’s light blue/lime theme and custom dialogs. Your existing
  green dashboard and both QR screens stay in place.

The configurable AI is the default, as requested. Set `BUSINESS_AI_MODE=wordpress`
to use the existing Tripanza webhook for bot replies while retaining the team
inbox and human handoff. Set `BUSINESS_WORKSPACE_ENABLED=false` to run the original
two bots alone. The old WordPress webhook logic remains in `bot.js`.

## Configuration

### Website knowledge and media

Website knowledge is enabled by default for `https://tripanza.com`, limited to
**manually selected public tours and their itineraries and accommodation**. The bot reads your existing
`/wp-json/tripanza-headless/v1/tours/{slug}` public WordPress API; it does not require the
legacy WhatsApp webhook secret, change your website, submit itinerary lead forms,
or index blog, account, and checkout pages. `WEBSITE_URL` sets the website origin.
This integration expects the Tripanza headless tour API on that origin.

Open **Website knowledge**, paste one full tour URL per line in **Tour links to
index**, and click **Save and index links**. Only those tours are fetched and used
for replies, PDFs, photos and videos; the whole-site catalogue is never crawled.
The selection starts empty, including after upgrading from automatic indexing.
Existing automatically indexed tours do not become approved links. URLs must be
on `WEBSITE_URL` under `/tour/` or `/tours/`; duplicates are combined and fragments
removed. Invalid sections, external URLs and query parameters are rejected.

Selections are stored in SQLite on the workspace disk. Editing the list and saving
removes excluded tours immediately; an empty saved list disables tour answers.
Indexing runs in the background, reports errors beside each saved URL, and continues
with other valid tours. **Refresh selected tours**, startup and the periodic refresh
(`WEBSITE_SYNC_HOURS`, 6 by default) only refresh the saved selection.
`WEBSITE_MAX_TOURS` defaults to 200. Live fact previews and stay galleries remain
available for indexed selections. A changed selection invalidates old sync results;
old customer memory and in-flight fact/media requests cannot restore removed tours.
Tour details are fetched live for each answer; unavailable website details lead
to clarification or human handoff rather than reuse of stale cached prices.

The configured OpenAI-compatible model uses function tools to search tours,
select verified fact IDs, and request the matching tour's media. OpenAI writes
natural WhatsApp replies using the latest message, conversation history, quoted
messages, and saved preferences. The writing style follows the conversation-quality
rules in the owner's PHP CRM reference: match English/Hindi/Hinglish, stay brief,
avoid repeated introductions or questions, and ask at most one useful question.
Detailed replies use WhatsApp `*bold headings*`, `- bullet points`, selective
highlights, and blank lines instead of dense paragraphs. Greetings, thanks, and
single clarification questions stay brief. Price exclusions and confirmation
caveats remain visible as points. Markdown heading/double-bold syntax is normalized
to WhatsApp formatting; a factual AI answer without a heading and bullets gets
one chance to correct its formatting before a verified-fact fallback. Itinerary, stay,
price, departure, and shortlist fallbacks are formatted too.
**Bot Config → Assistant writing instructions** now applies in website mode too.
Company contact details/general policies can come from administrator-provided
business information; trip details still come only from approved live website facts.

The consultant flow follows the owner's `whatsapp-ai-crm.php` reference: welcome
first-time enquiries once, continue active conversations without a lead-form reset,
and adapt to budget objections, calls, college/friends groups, private requirements,
parent/safety concerns, competitors, stays, deadlines, booking interest, and hesitation.
Already supplied details are captured quietly; ask one missing detail only when
needed for the current request. The selected trip's live evidence is loaded for
relevant turns, while a simple greeting/thanks does not fetch trip details.
The current destination overrides older selections; ambiguous variants need clarification.
Akshay's contact from the reference is available unless company information supplies
another phone number. Reference sales statistics and safety/property guarantees are
not treated as verified trip facts.

As in the reference, an unambiguous named trip in a customer's first message sends
its official itinerary PDF and available reels automatically. A plain hi sends no
random media. A stay enquiry sends that trip's accommodation gallery; returning
customers do not receive introduction files again. Files are deduplicated and capped
at six per turn, use the selected tour's approved assets, and retain pause/removal/
ownership guards. No email is required to send a PDF in WhatsApp. Name and email
volunteered in chat can be saved alongside trip preferences; an explicit email
itinerary request is handled by the team. This workspace does not implement the
reference's WordPress email sender or order/payment creation tools, and must never
claim those actions succeeded. Private quotes stay inactive pending their data connections.
A clear current request for a human enters the queue without repeated handoff messages.
"Talk to AI" resumes an unclaimed waiting chat with its existing context; it cannot
override an administrator's pause or an assigned agent.

Each proposed conversational reply is checked for supporting evidence, important
caveats, and relevance with one bounded model review request. Additional server
checks reject invented numeric amounts and model-written links. If the review
rejects a draft, the model gets specific correction feedback and one bounded rewrite
in the same conversation before a fallback. Provider review failures go straight to
verified facts or a context/language-aware conversation fallback. The review is a
model-based safeguard, not a mathematical guarantee; it adds one API request to a
normal conversational reply (up to 12 seconds), and a rejected reply can add one
rewrite plus a second review. Official links are appended by the server only when helpful. Arbitrary
free-form answers outside the tools and invented fact IDs are not delivered.
Greetings and thanks do not require fetching a tour. The assistant can discuss
customer requirements, but cannot provide outside travel information. Price replies
include the website's excluded costs when present. A chat reply never confirms a
booking or payment. Persona name remains configurable; website mode controls the
answer sources and does not use stock integrations as evidence. Saved preferences
include destination, dates, budget, travellers, sharing, pickup, interests, trip
type, accommodation, transport, name and email; only exact quotes from the customer's message
can be stored. A correction updates the corresponding preference. Attachment
history includes captions/type/name, without pretending to have inspected file
contents. A clear "yes" can accept a specific previous media offer; ambiguous
offers still need clarification. The provider must
support Chat Completions function calling; unsupported providers go to human handoff.

Customers can ask “send the itinerary PDF”, “send accommodation photos”, “send trip
photos”, or “send a video”. The bot uses the official tour PDF endpoint
`?generate_pdf=1&pdf_ready=1`, stay galleries, and tour media from your website.
Assets and redirects must stay on the configured website; placeholder/external
images are skipped. Images are converted to JPEG for WhatsApp. PDF/video downloads
are limited to 25 MB and image downloads to 10 MB, with up to six images or two
videos per request. A failed attachment returns its official website link instead.
An agent claim during generation or downloading cancels pending bot replies/media.
Accepted attachments are saved in the private workspace chat history.

Customer memory is stored in SQLite, separately for each WhatsApp customer:
selected tour, up to 48 recent customer excerpts, and explicitly stated dates,
budget, group size, sharing, pickup, and interests. Saved preferences must quote
the customer's own words and survive the rolling transcript limit. Recent chat
history is also supplied to the model. Context survives sessions and restarts
when `BUSINESS_DATA_DIR` is on a persistent disk; it expires after inactivity of
`CONTEXT_EXPIRY_DAYS` (90 by default). Customers can send `/forget`, `forget my
memory`, or `reset memory` to clear saved preferences and exclude prior chat
context from future AI replies. This retains the team inbox transcript.

For Render, add your key in **Bot Config → AI connection → AI API key** or set
`AI_API_KEY` in **Environment** (never commit it), keep
`BUSINESS_AI_MODE=workspace`, and set `BUSINESS_DATA_DIR` to a persistent disk mount.
The website URL and enabled flag already have the correct defaults. Set
`WEBSITE_KNOWLEDGE_ENABLED=false` only if you want the earlier business-info/stock
assistant mode.

`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, and `AI_MAX_TOKENS` configure the provider.
The API key stays on the server. Configure assistant behavior in **AI chatbot
settings**. Business hours use schedules such as `Monday-Friday 09:00-17:00` in
the business information field, interpreted in `TIMEZONE`.

The workspace owner (super administrator) can paste an API key under **Bot Config
→ AI connection** and choose **Save API key**. A saved key takes precedence over
`AI_API_KEY` on Render and is applied to new requests immediately, without a server
restart. It is encrypted with AES-256-GCM in the private workspace database; API
responses, audit records, and the form never return the saved key. Other
administrators can see connection status but cannot change provider credentials.
Leave the input blank to keep the current key. **Use Render key** removes the saved
override when an environment key is configured. **Remove saved key** removes it
when no environment key exists. Provider URL and model remain controlled by the
existing `AI_BASE_URL` and `AI_MODEL` settings on Render.

After saving, **Test connection** makes one small server-side request to check the
key and the model's function-tool support. It reports authentication, model access,
quota, and connection errors without exposing provider error bodies or credentials.
The test sends no WhatsApp messages. A persistent `BUSINESS_DATA_DIR` is required
to retain settings keys across deployments; keep its `credentials.json` or a stable
`APP_SECRET`, since that secret protects encryption as well as workspace sessions.

Configure stock under **Stock integration**. Google Sheets requires a service
account JSON file on the server and sharing the sheet with that account. Set its
`credentials_path` in the connector JSON. Database connectors require read-only
database credentials. `STOCK_CACHE_TTL_SECONDS` controls refresh (60 by default);
`STOCK_CURRENCY` defaults to INR. No stock source is activated automatically.

Web push requires HTTPS, user notification permission, and VAPID keys. Generate
keys with `node business/generate-push-keys.js` and put them in `.env`. Browser
notifications are the fallback when push is unavailable. Group notifications
are off by default; configure the group JID in agent settings to enable them.

Persistent workspace data and private uploads live in `business/data/`. For
Render or Docker, mount a persistent disk and set `BUSINESS_DATA_DIR` to it.
WhatsApp sessions automatically use `BUSINESS_DATA_DIR/whatsapp-auth/auth_crm`
and `BUSINESS_DATA_DIR/whatsapp-auth/auth_notifications`. You can instead set
`WHATSAPP_AUTH_DIR` to a separate persistent directory. Without either setting,
the original project-root `auth_crm` and `auth_notifications` paths still work.
An existing session is copied completely to its new disk location on first
startup; the original is retained and an existing disk identity is never replaced.
Set `FRONTEND_URL` to the public HTTPS origin.

Each bot has one connection manager. It coalesces startup requests, waits for
credential saves before reconnecting, ignores events from retired sockets and
backs off temporary failures. A replaced connection (440), logout or invalid
session stops automatic reconnects; check for another running bot instance or
inspect linked devices before connecting again. No error automatically deletes
keys or unlinks your account. The bot stays unavailable as a global presence so
the primary phone can receive notifications; this does not disable replies.

Original message protobufs, including media keys, are kept in a bounded private
memory cache for up to 24 hours (2,000 entries and 8 MiB of encoded payloads per
bot, evicting oldest entries first). Baileys can use them for
retry receipts after a socket reconnect. This cache clears on process restart or
logout. It does not restore messages that the primary phone already cannot decrypt.
Logs beginning `[whatsapp:crm]` or `[whatsapp:notifications]` report disconnect
codes and decryption/retry warning categories without exposing message bodies or
encryption keys. Verify any recovery with a fresh incoming message on the phone
after deployment; automated tests use mocked connections, not live WhatsApp.

Connections do not request the phone's full archive; bootstrap/recent/identity
sync and message decryption retries remain enabled. Existing workspace history
and customer memory remain in SQLite. Link previews use standard thumbnails
instead of uploading high-resolution previews; photo/PDF attachments still work.
Connection attempts have a 60-second timeout. Repeated failures back off from one
second to five minutes, resetting after a successful connection. A 408 is a
WhatsApp connection timeout, not a reason to delete credentials or pair again.

## Chat controls

Casual messages, lyrics, jokes, greetings and unrelated chatter stay with the
assistant. The model cannot put an unrelated turn into the team queue through a
transfer tool or handoff flag, even after a previous trip enquiry. Missing AI
credentials, provider failures and empty output also give casual turns a friendly
travel prompt. Actual customer requests, configured escalation phrases and
business enquiries needing team verification retain the handoff flow. Escalation
phrases match whole words/phrases, not substrings inside unrelated words. Queue
messages do not promise an agent's response time. Deployment logs record rejected
automatic handoffs and the reason for accepted transfers without message contents.

Open a conversation and use its three-dot menu:

- **Pause AI replies** keeps incoming messages in the inbox while stopping AI
  responses for that conversation. The pause survives restarts. Pending AI work
  and attachments are cancelled, including across a quick pause/resume. Paused
  conversations are excluded from automatic inactivity closure.
- **Resume AI replies** returns the live conversation to the assistant and releases
  any assigned agent. The assistant answers future incoming messages; it does not
  replay messages received while paused. Assigned agents and administrators can
  control owned chats; agents can also control unclaimed chats. Resolved sessions
  must be managed through the customer's current live conversation.
- **Delete chat** is administrator-only and requires an in-app confirmation. It
  removes this workspace conversation, messages, and notes, resets the customer's
  saved AI context/summary, and removes attachments no other conversation uses.
  The customer record and other sessions remain. WhatsApp messages on phones are
  unaffected. A future message can create a new conversation. Deletion is audited
  and immediately reflected in connected inboxes.

An agent's existing **Hold/Unhold** controls remain separate from returning a
conversation to AI.

## Private-trip setup

Open **Workspace → Private trips** to save multiple Google Sheets links and
worksheet names for hotel rates, transport, activities, or itineraries. Add
trusted vendor websites, choose the preferred source policy, and set a percentage
of base cost or fixed INR markup per quote. The owner can edit these settings;
administrators can view them. Links, preferences, and markup persist in the
workspace database. Sharing parameters are removed from Google Sheets links.
Leave the markup value blank if it will be decided later. The sample calculation
previews the selling price without sending any customer messages.

This page stores setup only: automatic private-trip quoting remains inactive.
It does not fetch sheets, scrape vendors, book travel, or generate a customized
itinerary. Actual sheet access, column/rate-unit mapping, seasonal and occupancy
rules, and supported vendor connections must be configured before live quotes
can start. Do not enter passwords or API keys in the sheet/vendor fields. Existing
website knowledge and group-trip replies continue to use the approved tour links.

## WordPress itinerary emails and group-trip bookings

Open **Workspace → AI chatbot settings → Website email & bookings** as the
workspace owner. Download the bridge plugin, then on your website open
**WordPress → Plugins → Add New → Upload Plugin**, upload the ZIP and activate it.
Keep the existing reference Tripanza WhatsApp AI CRM plugin active, along with
the website's itinerary renderer and payment pages. The bridge reuses
`build_tour_itinerary_html()` and `tripanza_create_tour_booking()`; it does not
replace your website chatbot or its booking system.

In WordPress open **Settings → Tripanza Workspace → Generate connection key**.
Copy the key shown once into the workspace's **WordPress connection key** field,
choose email/booking features, save, then **Test connection**. The test reads
capabilities without sending mail or creating orders. This key is separate from
the OpenAI key, is encrypted in the workspace database, and is never returned to
the browser after saving. Changing the website origin or key requires another
test. Disconnecting disables these actions. Generating a new WordPress key
revokes the previous key.

- **Email:** customers explicitly request an itinerary email, or give their
  email in response to the assistant's itinerary-email question. The bot uses
  the exact selected group tour and volunteered email, submits the website's
  official itinerary through WordPress mail, and reports its actual acceptance
  or failure. Mail acceptance does not prove inbox delivery; your site's mail
  delivery configuration still applies. Existing CRM lead creation is reused
  when available.
- **Booking:** only a request to book/pay starts collection of the missing
  essentials. The customer's WhatsApp phone is already known. Quad/triple/twin
  values mean **traveller counts by sharing**, matching the reference's legacy
  adults/children/infants arguments. WordPress verifies a published future group
  departure, sharing prices, discounts, configured tax and deposit. The bot
  presents the exact tour, date, sharing, name/email, total and advance for review.
  No order exists at this point. Replying **confirm booking** creates the pending
  order and shares its actual website PayU/UPI links. Gateway fees and excluded
  trip costs are not invented or silently added. A price change requires a fresh
  review; edited preferences invalidate an old draft. Drafts expire after
  15 minutes and are invalidated by AI ownership/pause changes.
- **Retries:** WordPress reserves each action request atomically and returns its
  saved receipt on retries. A crash or uncertain outcome cannot automatically
  create a second order or resend an email with the same request ID; the team
  must check unresolved actions. Booking creation does not prove payment or
  confirm seats. Payment verification remains with the existing website/team.

Both actions are limited to manually selected group-tour links and active AI
chats. Private quotes remain inactive. Pausing/deleting a chat prevents further
actions; it cannot undo an email or WordPress order already submitted. Deleting
a workspace conversation removes its action drafts with its history, while
existing website orders and WordPress duplicate-protection receipts remain.

The plugin source is [business/wordpress/tripanza-workspace-bridge.php](business/wordpress/tripanza-workspace-bridge.php).
It must be installed on WordPress and connected before these features become
active; pushing the bot repository alone does not install website plugins.

## Messaging & automation

Open **Messaging & automation** in the workspace sidebar (`/admin/automation`).
This adds gateway features inspired by [WA-AKG](https://github.com/mrifqidaffaaditya/WA-AKG)
without replacing the existing Tripanza assistant, website knowledge or team inbox.

- **Scheduler / Broadcasts:** choose an account, international phone numbers or
  group JIDs, message content, optional public HTTPS image/MP4/PDF, and a schedule
  with a timezone. Attachments are limited to 8 MB. Save a draft, use **Review**
  to inspect all recipients/content, then **Start**. Pausing/canceling affects
  pending jobs; a message already being sent cannot be recalled. Delivery runs
  one recipient at a time with 10–30 second gaps. These delays do not guarantee
  protection from WhatsApp restrictions. Scheduled jobs need the service running;
  a sleeping service processes overdue jobs after it wakes. Use persistent storage
  for schedules to survive redeployments.
- **Delivery records:** `sent` means accepted by WhatsApp, with delivery/read
  status updated when a receipt is available. `unknown` means the transport or
  process failed during a send: verify WhatsApp before sending again. Uncertain
  jobs are never automatically resent after a restart. Offline accounts wait
  until they reconnect. The worker uses one in-flight delivery to bound memory.
- **Keyword rules:** exact, contains or starts-with matching; private/group/all
  context, priority, cooldown and allowed/excluded numbers/groups. Rules are off
  until enabled. CRM rules precede AI but preserve escalation keywords, agent
  ownership, hold and AI pause. Pending CRM rule replies recheck those controls
  after downloading media. Changes to manually scheduled campaigns are separate
  from the chat's AI pause control.
- **Groups:** view up to 200 groups per QR account, inspect/export members,
  create groups, rename them, change descriptions, change announcement mode and
  add/remove/promote/demote participants. WhatsApp permissions/privacy settings
  still apply; inspect participant results for rejected actions. A group can be
  selected directly for a broadcast. Meta accounts do not provide these group
  controls.
- **Accounts:** owners can add up to four extra QR or Meta accounts. Each has
  separate routing, rules, campaigns and activity. The original CRM keeps the
  AI team inbox; extra accounts do not automatically run the AI assistant.
  Connect a QR account and scan its code; activated accounts reconnect after
  restart. **Pause connection** retains linked-device keys; **Unlink** logs out;
  **Remove** stops the account and cancels pending sends while retaining its auth
  files. Every connected account uses additional hosting RAM.
- **Webhooks / n8n:** owners configure HTTPS endpoints, event choices and a
  signing secret. The raw JSON body is signed with HMAC-SHA256 in
  `X-Tripanza-Signature: sha256=...`. Check the signature and deduplicate using
  `X-Tripanza-Event-ID` / envelope `id`; failed deliveries retry up to five times.
  Use an n8n Webhook node for incoming events and an HTTP Request node for actions.
  Generate an automation API key, copy it once, then supply `X-API-Key` to
  `/api/automation` endpoints. Keys can create/start campaigns, manage rules and
  operate groups; they cannot change account credentials, webhook secrets or
  issue new keys. Revocation takes effect immediately.
- **Buttons:** add up to three URL/reply buttons in the composer or keyword rule.
  Default link mode uses readable URLs/reply prompts. Experimental QR mode sends
  readable text first, then a native-flow card, preserving the fallback even when
  the card fails or a client cannot render it. AI replies with links also receive
  a URL card in this mode. Reply-button selections enter the normal conversation
  flow. Experimental cards are not guaranteed to render on every WhatsApp client.

**Meta Cloud API setup:** choose Meta when adding an account, and enter the phone
number ID, Graph API version, access token, app secret and webhook verification
token in the frontend. Credentials are encrypted using the workspace secret and
are never returned by the API. Use **Test connection**, then configure the shown
`/api/automation/meta/webhook/ACCOUNT_ID` URL in Meta, subscribe to messages, and
use the same verification token. POST events require Meta's app-secret signature.
Personal phone-number messages and official URL/reply buttons are supported inside
the 24-hour customer reply window. Outside that window, select an approved template
and enter its language/body parameters. Static website/call buttons are configured
on the approved template in WhatsApp Manager. Template media headers and dynamic
template-button parameters are not exposed in this composer.

Activity history keeps the latest 5,000 events. Temporary deduplication/cooldown
records expire after seven days and completed delivery records after 30 days.
Pending schedules remain until sent or canceled. Admin operations are audited;
external downloads/webhooks reject private-network addresses and redirects, and
have byte limits and a 12-second deadline. API keys/Meta/webhook secrets never
appear in delivery-error logs. Tests use fake sockets and transport providers.

## Validation

```sh
npm run check
npm test
php tests/wordpress-bridge.php
```

Tests use an isolated SQLite database, a mocked WhatsApp adapter, and a local AI
provider. They do not connect to WhatsApp or send real messages. External stock,
provider, and push services need their own credentials for live operation.

## Attribution

The workspace is adapted from WA-AKG-business under the MIT license. See
[business/NOTICE.md](business/NOTICE.md) and [business/LICENSE](business/LICENSE).
