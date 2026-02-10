import type { VercelRequest, VercelResponse } from '@vercel/node';

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

type RateEntry = {
  count: number;
  firstAt: number;
  lastAt: number;
};

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MIN_INTERVAL_MS = 10 * 1000;
const RATE_STORE_TTL_MS = RATE_LIMIT_WINDOW_MS * 2;
const RATE_STORE_MAX = 1000;
const rateStore = new Map<string, RateEntry>();

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

function pruneRateStore(now: number) {
  for (const [key, entry] of rateStore.entries()) {
    if (now - entry.lastAt > RATE_STORE_TTL_MS) {
      rateStore.delete(key);
    }
  }

  if (rateStore.size <= RATE_STORE_MAX) return;

  const sorted = Array.from(rateStore.entries()).sort((a, b) => a[1].lastAt - b[1].lastAt);
  const overflow = rateStore.size - RATE_STORE_MAX;
  for (let i = 0; i < overflow; i += 1) {
    rateStore.delete(sorted[i][0]);
  }
}

function enforceRateLimit(ip: string): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  pruneRateStore(now);
  const entry = rateStore.get(ip);

  if (!entry || now - entry.firstAt > RATE_LIMIT_WINDOW_MS) {
    const fresh = { count: 0, firstAt: now, lastAt: 0 };
    rateStore.set(ip, fresh);
  }

  const active = rateStore.get(ip)!;
  const sinceLast = active.lastAt ? now - active.lastAt : Number.POSITIVE_INFINITY;
  if (sinceLast < MIN_INTERVAL_MS) {
    return { limited: true, retryAfter: Math.ceil((MIN_INTERVAL_MS - sinceLast) / 1000) };
  }

  if (active.count >= RATE_LIMIT_MAX) {
    const windowRemaining = RATE_LIMIT_WINDOW_MS - (now - active.firstAt);
    return { limited: true, retryAfter: Math.ceil(windowRemaining / 1000) };
  }

  active.count += 1;
  active.lastAt = now;
  rateStore.set(ip, active);

  return { limited: false, retryAfter: 0 };
}

function sanitizeText(value: string, maxLength: number): string {
  return value
    .replace(/[\[\]()_*~`>#|<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch (error) {
    return undefined;
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

  const parsed = parsePayload(req.body);
  if (!parsed) {
    res.status(400).json({ ok: false, error: 'Invalid payload' });
    return;
  }

  const ip = getClientIp(req);
  const rate = enforceRateLimit(ip);
  if (rate.limited) {
    res.setHeader('Retry-After', rate.retryAfter.toString());
    res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    return;
  }

  const rawName = typeof parsed.name === 'string' ? parsed.name : '';
  const name = sanitizeText(rawName, 60) || '(no name)';

  const gifts = Array.isArray(parsed.gifts) ? parsed.gifts : [];
  if (gifts.length !== 2) {
    res.status(400).json({ ok: false, error: 'Exactly two gifts are required' });
    return;
  }

  const sanitizedGifts = gifts.map((gift, index) => {
    const title = typeof gift?.title === 'string' ? gift.title : `Gift ${index + 1}`;
    return {
      title: sanitizeText(title, 80) || `Gift ${index + 1}`,
      linkUrl: sanitizeUrl(typeof gift?.linkUrl === 'string' ? gift.linkUrl : undefined)
    };
  });

  const createdAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : '';
  const createdAtDate = new Date(createdAt);
  const timestamp = Number.isNaN(createdAtDate.getTime())
    ? new Date().toISOString()
    : createdAtDate.toISOString();

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
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
      name: 'Timestamp',
      value: timestamp,
      inline: false
    }
  ];

  try {
    const response = await fetch(webhookUrl, {
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
    });

    if (!response.ok) {
      res.status(502).json({ ok: false, error: 'Webhook request failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}
