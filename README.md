# Valentine SPA

A modern Valentine-themed single-page React app with a Discord webhook notification.

## Install & Run

```bash
npm install
npm run dev
```

## Discord Webhook Setup

1. In your Discord server, open **Server Settings** -> **Integrations** -> **Webhooks**.
2. Create a new webhook, choose a channel, and copy the webhook URL.
3. Set the environment variable on Vercel:

```
DISCORD_WEBHOOK_URL=your_webhook_url_here
```

### Security Note

Never expose or commit your Discord webhook URL. Keep it server-side only (Vercel environment variable).

## How to Edit Gifts

Edit `src/data/gifts.ts` to update gift titles, descriptions, images, and links. Replace the placeholder image URLs with your own.

## How to Set the Name

Edit `src/data/recipient.ts` and replace the `recipientName` value.

## Serverless Endpoint

The API route lives at `api/valentine.ts` and expects a POST JSON payload:

```json
{
  "name": "string",
  "gifts": [{ "id": "string", "title": "string", "linkUrl": "string" }],
  "createdAt": "ISO timestamp"
}
```

It validates input, rate limits requests, and sends a Discord embed notification.
