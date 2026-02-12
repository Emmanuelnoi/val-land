import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createRateLimiter,
  getClientIp,
  hasValidChallenge,
  isDiscordWebhook,
  sanitizePublicHttpsUrl,
  sanitizeText
} from '../src/server/security.js';

type IncomingGift = {
  id?: string;
  title?: string;
  linkUrl?: string;
};

type IncomingPayload = {
  name?: string;
  gifts?: IncomingGift[];
  createdAt?: string;
};

const limiter = createRateLimiter({
  max: 5,
  windowMs: 60 * 60 * 1000,
  minIntervalMs: 10_000,
  namespace: 'legacy-submit',
  blockOnBackendFailure: true
});

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parsePayload(body: unknown): IncomingPayload | null {
  if (!body || typeof body !== 'object') return null;

  const candidate = body as Record<string, unknown>;
  if (candidate.gifts !== undefined && !Array.isArray(candidate.gifts)) return null;

  const gifts = Array.isArray(candidate.gifts) ? candidate.gifts : undefined;
  if (gifts && gifts.some((gift) => !gift || typeof gift !== 'object')) return null;

  return {
    name: typeof candidate.name === 'string' ? candidate.name : undefined,
    gifts: gifts as IncomingGift[] | undefined,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  if (!hasValidChallenge(req)) {
    res.status(403).json({ ok: false, error: 'Challenge failed' });
    return;
  }

  const parsed = parsePayload(req.body);
  if (!parsed) {
    res.status(400).json({ ok: false, error: 'Invalid payload' });
    return;
  }

  const ip = getClientIp(req);
  const rate = await limiter(ip);
  if (rate.limited) {
    res.setHeader('Retry-After', rate.retryAfter.toString());
    res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    return;
  }

  const rawName = typeof parsed.name === 'string' ? parsed.name : '';
  const name = sanitizeText(rawName, 60) || '(no name)';

  const gifts = Array.isArray(parsed.gifts) ? parsed.gifts : [];
  if (gifts.length !== 3) {
    res.status(400).json({ ok: false, error: 'Exactly three gifts are required' });
    return;
  }

  const sanitizedGifts = gifts.map((gift, index) => {
    const title = typeof gift?.title === 'string' ? gift.title : `Gift ${index + 1}`;
    return {
      title: sanitizeText(title, 80) || `Gift ${index + 1}`,
      linkUrl: sanitizePublicHttpsUrl(typeof gift?.linkUrl === 'string' ? gift.linkUrl : undefined)
    };
  });

  const createdAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : '';
  const createdAtDate = new Date(createdAt);
  const timestamp = Number.isNaN(createdAtDate.getTime())
    ? new Date().toISOString()
    : createdAtDate.toISOString();

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || !isDiscordWebhook(webhookUrl)) {
    res.status(500).json({ ok: false, error: 'Server not configured' });
    return;
  }

  const embedFields = [
    {
      name: 'Name',
      value: name,
      inline: true
    },
    {
      name: 'Gift 1',
      value: sanitizedGifts[0].linkUrl
        ? `${sanitizedGifts[0].title}\n${sanitizedGifts[0].linkUrl}`
        : sanitizedGifts[0].title,
      inline: false
    },
    {
      name: 'Gift 2',
      value: sanitizedGifts[1].linkUrl
        ? `${sanitizedGifts[1].title}\n${sanitizedGifts[1].linkUrl}`
        : sanitizedGifts[1].title,
      inline: false
    },
    {
      name: 'Gift 3',
      value: sanitizedGifts[2].linkUrl
        ? `${sanitizedGifts[2].title}\n${sanitizedGifts[2].linkUrl}`
        : sanitizedGifts[2].title,
      inline: false
    },
    {
      name: 'Timestamp',
      value: timestamp,
      inline: false
    }
  ];

  try {
    const response = await fetchWithTimeout(
      webhookUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowed_mentions: { parse: [] },
          embeds: [
            {
              title: 'New Valentine Submission',
              color: 0xea2f60,
              fields: embedFields,
              footer: { text: 'Valentine App' }
            }
          ]
        })
      },
      5000
    );

    if (!response.ok) {
      res.status(502).json({ ok: false, error: 'Webhook request failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}
