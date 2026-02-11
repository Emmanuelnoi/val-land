# Valentine SPA

A modern Valentine-themed single-page React app with a public creator flow and Discord notifications.

## What’s New

- **Public creator page** at `/create` to build personalized Valentines
- **Share link** for recipients at `/v/:slug`
- **Private results link** at `/v/:slug/results?key=...` (shown once)
- **Optional creator Discord notifications** per Valentine
- **Theme packs** (Valentine, Birthday Neutral/Bold/Blush, Red/Yellow/Blue/Green, Mono Dark/Light, Midnight) for multiple occasions

## Install & Run

```bash
npm install
npm run dev
```

For local API testing, run the serverless functions:

```bash
npm run dev:api
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
```


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
- `GET /api/results?slug=...&key=...`
- `GET /api/health/kv` (connectivity check)

### Security Notes

- Creator webhooks are stored only server-side.
- Admin tokens are hashed in storage (tokens are returned only once).
