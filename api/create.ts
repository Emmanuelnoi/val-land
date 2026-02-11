import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kvGet, kvSet } from '../src/server/kv';
import {
  createRateLimiter,
  generateSlug,
  generateToken,
  getClientIp,
  hashToken,
  isDiscordWebhook,
  sanitizeText,
  sanitizeUrl
} from '../src/server/security';
import type { Gift } from '../src/lib/types';

type IncomingGift = Partial<Gift>;

type IncomingPayload = {
  toName?: string;
  message?: string;
  gifts?: IncomingGift[];
  creatorDiscordWebhookUrl?: string;
};

const limiter = createRateLimiter({
  max: 10,
  windowMs: 60 * 60 * 1000,
  minIntervalMs: 5000
});

function getBaseUrl(req: VercelRequest): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'] ?? req.headers.host;
  const proto =
    (typeof protoHeader === 'string' ? protoHeader.split(',')[0] : undefined) ?? 'https';
  const host =
    (typeof hostHeader === 'string' ? hostHeader.split(',')[0] : undefined) ?? '';
  if (!host) return '';
  return `${proto}://${host}`;
}

function parsePayload(body: unknown): IncomingPayload | null {
  if (!body || typeof body !== 'object') return null;
  return body as IncomingPayload;
}

function normalizeGift(gift: IncomingGift, index: number): Gift | null {
  const title = sanitizeText(gift.title ?? '', 60);
  const description = sanitizeText(gift.description ?? '', 140);
  const imageUrl = sanitizeUrl(gift.imageUrl);
  const linkUrl = sanitizeUrl(gift.linkUrl);
  const id = sanitizeText(gift.id ?? `gift-${index + 1}`, 40)
    .toLowerCase()
    .replace(/\s+/g, '-');

  if (!title || !description || !imageUrl) return null;

  return {
    id: id || `gift-${index + 1}`,
    title,
    description,
    imageUrl,
    linkUrl
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const rate = limiter(getClientIp(req));
  if (rate.limited) {
    res.setHeader('Retry-After', rate.retryAfter.toString());
    res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    return;
  }

  const parsed = parsePayload(req.body);
  if (!parsed) {
    res.status(400).json({ ok: false, error: 'Invalid payload' });
    return;
  }

  const toName = sanitizeText(parsed.toName ?? '', 60);
  const message = sanitizeText(parsed.message ?? '', 180);

  if (!toName || !message) {
    res.status(400).json({ ok: false, error: 'Name and message are required' });
    return;
  }

  const giftsInput = Array.isArray(parsed.gifts) ? parsed.gifts : [];
  if (giftsInput.length < 3 || giftsInput.length > 12) {
    res.status(400).json({ ok: false, error: 'Gifts must be between 3 and 12' });
    return;
  }

  const gifts: Gift[] = [];
  for (let i = 0; i < giftsInput.length; i += 1) {
    const normalized = normalizeGift(giftsInput[i], i);
    if (!normalized) {
      res.status(400).json({ ok: false, error: 'Invalid gift data' });
      return;
    }
    gifts.push(normalized);
  }

  let creatorNotify: { type: 'discord'; webhookUrl: string } | undefined;
  if (parsed.creatorDiscordWebhookUrl) {
    const webhook = sanitizeUrl(parsed.creatorDiscordWebhookUrl);
    if (!webhook || !isDiscordWebhook(webhook)) {
      res.status(400).json({ ok: false, error: 'Invalid Discord webhook URL' });
      return;
    }
    creatorNotify = { type: 'discord', webhookUrl: webhook };
  }

  const createdAt = new Date().toISOString();
  const adminToken = generateToken(32);
  const adminTokenHash = hashToken(adminToken);

  let slug = '';
  try {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = generateSlug(8);
      const existing = await kvGet(`val:cfg:${candidate}`);
      if (!existing) {
        slug = candidate;
        break;
      }
    }

    if (!slug) {
      res.status(500).json({ ok: false, error: 'Unable to create slug' });
      return;
    }

    await kvSet(`val:cfg:${slug}`, {
      slug,
      toName,
      message,
      gifts,
      creatorNotify,
      createdAt,
      adminTokenHash
    });

    await kvSet(`val:subs:${slug}`, []);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'KV not configured' });
    return;
  }

  res.status(200).json({
    ok: true,
    slug,
    shareUrl: (() => {
      const baseUrl = getBaseUrl(req);
      const path = `/v/${slug}`;
      return baseUrl ? `${baseUrl}${path}` : path;
    })(),
    resultsUrl: (() => {
      const baseUrl = getBaseUrl(req);
      const path = `/v/${slug}/results?key=${adminToken}`;
      return baseUrl ? `${baseUrl}${path}` : path;
    })()
  });
}
