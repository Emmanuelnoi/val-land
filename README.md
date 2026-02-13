# Valentine SPA

A modern Valentine-themed single-page React app with a public creator flow and Discord notifications.

## What’s New

- **Public creator page** at `/create` to build personalized Valentines
- **Share link** for recipients at `/v/:slug`
- **Private results link** at `/v/:slug/results#key=...` (shown once)
- **Optional creator Discord notifications** per Valentine
- **Theme packs** (Valentine, Birthday Neutral/Bold/Blush, Red/Orange/Yellow/Green/Blue/Purple, Mono Dark/Light, Midnight) for multiple occasions

## Install & Run

```bash
npm install
npm run dev
```

For local API testing, run the serverless functions:

```bash
npm run dev:api
```

Useful checks:

```bash
npm run test:run
npm run test:contract
npm run build
```

## Creator Flow

1. Visit `/create`, choose a theme, and fill in the recipient name, message, and gifts.
2. (Optional) Add your Discord webhook for notifications.
3. Generate a **share link** (send to recipient).
4. Save the **results link** (only shown once).

## Discord Webhook Setup

- **Default recipient flow** uses `DISCORD_WEBHOOK_URL` (global).
- **Creator flow** uses the webhook entered on `/create` (stored server-side only).

1. In your Discord server, open **Server Settings** -> **Integrations** -> **Webhooks**.
2. Create a new webhook, choose a channel, and copy the webhook URL.
3. Set the environment variable on Vercel:

```
DISCORD_WEBHOOK_URL=your_webhook_url_here
```

### Security Note

Never expose or commit your Discord webhook URL. Keep it server-side only (Vercel environment variable).

## Upstash Redis Setup

This app uses Upstash Redis (REST) for public creator storage.

Set these environment variables on Vercel:

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
APP_BASE_URL=https://your-domain.example
ANTI_ABUSE_CHALLENGE_TOKEN=...
HEALTHCHECK_TOKEN=...
CREATOR_NOTIFY_ENCRYPTION_KEY=...
```

### Additional Security Hardening

- `APP_BASE_URL`: canonical origin used for share/results links (prevents forwarded-host poisoning).
- `ANTI_ABUSE_CHALLENGE_TOKEN`: recommended primary signing secret for anti-abuse challenge tokens used by `POST /api/create`, `POST /api/submit`, and `POST /api/valentine`.
- `HEALTHCHECK_TOKEN`: if set, `GET /api/health/kv` requires header `x-healthcheck-token`.
- `CREATOR_NOTIFY_ENCRYPTION_KEY`: required to encrypt creator Discord webhook URLs before storing them in KV. If `ANTI_ABUSE_CHALLENGE_TOKEN` is unset, this key is used as fallback challenge signing secret.
- Browser clients fetch short-lived signed challenges from `GET /api/challenge` automatically before protected POSTs.


## How to Edit Default Gifts

Edit `src/data/gifts.ts` to update gift titles, descriptions, images, and links. Replace the placeholder image URLs with your own.

## How to Set the Default Name & Message

Edit `src/data/recipient.ts` and update `recipientName` and `recipientMessage`.

## Serverless Endpoint

The default API route lives at `api/valentine.ts` and expects a POST JSON payload:

```json
{
  "name": "string",
  "gifts": [{ "id": "string", "title": "string", "linkUrl": "string" }],
  "createdAt": "ISO timestamp"
}
```

It validates input, rate limits requests, and sends a Discord embed notification.

### Creator Endpoints

- `POST /api/create`
- `GET /api/config?slug=...`
- `POST /api/submit`
- `POST /api/results` with JSON body `{ "slug": "...", "key": "..." }`
- `GET /api/health/kv` (connectivity check)
- `POST /api/telemetry` (client diagnostics: challenge/CSP/image errors)

### Security Notes

- Creator webhooks are encrypted before storage and decrypted server-side only when dispatching notifications.
- Admin tokens are hashed in storage (tokens are returned only once).
- API and client diagnostics are emitted as structured events for challenge, webhook, CSP, and image-load failures.

## Engineering Ops Docs

- `docs/ops/kpi-slo-scorecard.md`
- `docs/adr/0001-external-image-delivery-csp.md`
- `docs/security/threat-model.md`
- `docs/roadmap/engineering-roadmap-2026.md`
- `docs/runbooks/release-checklist.md`
- `docs/runbooks/incident-operations.md`
