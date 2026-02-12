import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { kvAppend, kvGet, kvSet } from '../src/server/kv.js';
import {
  createRateLimiter,
  decryptSecret,
  encryptSecret,
  getClientIp,
  hasValidChallenge,
  isDiscordWebhook,
  isValidSlug,
  sanitizePublicHttpsUrl,
  sanitizeText,
  toSafeString
} from '../src/server/security.js';
import type { Gift, SelectedGift } from '../src/lib/types.js';

type IncomingPayload = {
  slug?: string;
  pickedGifts?: Array<{ id?: string }>;
};

type CreatorNotifyConfig = {
  type: 'discord';
  webhookCiphertext?: string;
  webhookUrl?: string;
};

const limiter = createRateLimiter({
  max: 12,
  windowMs: 60 * 60 * 1000,
  minIntervalMs: 5000,
  namespace: 'submit',
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
  if (candidate.slug !== undefined && typeof candidate.slug !== 'string') return null;
  if (candidate.pickedGifts !== undefined && !Array.isArray(candidate.pickedGifts)) return null;

  const picks = Array.isArray(candidate.pickedGifts) ? candidate.pickedGifts : undefined;
  if (picks) {
    for (const pick of picks) {
      if (!pick || typeof pick !== 'object') return null;
      const normalized = pick as Record<string, unknown>;
      if (normalized.id !== undefined && typeof normalized.id !== 'string') return null;
    }
  }

  return {
    slug: candidate.slug as string | undefined,
    pickedGifts: picks as Array<{ id?: string }> | undefined
  };
}

function pickGift(configGifts: Gift[], id: string): SelectedGift | null {
  const match = configGifts.find((gift) => gift.id === id);
  if (!match) return null;
  const imageUrl = sanitizePublicHttpsUrl(match.imageUrl);
  if (!imageUrl) return null;
  return {
    id: match.id,
    title: sanitizeText(match.title, 60),
    linkUrl: sanitizePublicHttpsUrl(match.linkUrl),
    imageUrl
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

  const rate = await limiter(getClientIp(req));
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

  const slug = typeof parsed.slug === 'string' ? parsed.slug : '';
  if (!isValidSlug(slug)) {
    res.status(400).json({ ok: false, error: 'Invalid slug' });
    return;
  }

  const picks = Array.isArray(parsed.pickedGifts) ? parsed.pickedGifts : [];
  if (picks.length !== 3) {
    res.status(400).json({ ok: false, error: 'Exactly three gifts are required' });
    return;
  }

  let config:
    | {
        toName: string;
        message: string;
        gifts: Gift[];
        creatorNotify?: CreatorNotifyConfig;
        [key: string]: unknown;
      }
    | null;
  try {
    config = await kvGet(`val:cfg:${slug}`);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'KV not configured' });
    return;
  }

  if (!config) {
    res.status(404).json({ ok: false, error: 'Config not found' });
    return;
  }

  const pickedGifts: SelectedGift[] = [];
  for (const pick of picks) {
    const id = sanitizeText(toSafeString(pick?.id), 40);
    const gift = id ? pickGift(config.gifts, id) : null;
    if (!gift) {
      res.status(400).json({ ok: false, error: 'Invalid gift selection' });
      return;
    }
    if (pickedGifts.some((existing) => existing.id === gift.id)) {
      res.status(400).json({ ok: false, error: 'Duplicate gifts not allowed' });
      return;
    }
    pickedGifts.push(gift);
  }

  const submission = {
    id: crypto.randomUUID ? crypto.randomUUID() : `sub_${Date.now()}`,
    pickedGifts,
    pickedAt: new Date().toISOString()
  };

  try {
    await kvAppend(`val:subs:${slug}`, submission);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'KV not configured' });
    return;
  }

  let creatorWebhookUrl: string | undefined;
  if (config.creatorNotify?.type === 'discord') {
    if (typeof config.creatorNotify.webhookCiphertext === 'string') {
      const decryptedWebhook = decryptSecret(config.creatorNotify.webhookCiphertext);
      if (decryptedWebhook && isDiscordWebhook(decryptedWebhook)) {
        creatorWebhookUrl = decryptedWebhook;
      }
    } else if (typeof config.creatorNotify.webhookUrl === 'string') {
      if (isDiscordWebhook(config.creatorNotify.webhookUrl)) {
        creatorWebhookUrl = config.creatorNotify.webhookUrl;
      }

      const webhookCiphertext = encryptSecret(config.creatorNotify.webhookUrl);
      if (webhookCiphertext) {
        config.creatorNotify = { type: 'discord', webhookCiphertext };
        await kvSet(`val:cfg:${slug}`, config).catch(() => undefined);
      }
    }
  }

  if (creatorWebhookUrl) {
    const [gift1, gift2, gift3] = pickedGifts;
    await fetchWithTimeout(
      creatorWebhookUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowed_mentions: { parse: [] },
          embeds: [
            {
              title: 'New gift selection',
              color: 0xea2f60,
              fields: [
                {
                  name: 'To',
                  value: config.toName || 'Valentine',
                  inline: true
                },
                {
                  name: 'Gift 1',
                  value: gift1.linkUrl ? `${gift1.title}\n${gift1.linkUrl}` : gift1.title,
                  inline: false
                },
                {
                  name: 'Gift 2',
                  value: gift2.linkUrl ? `${gift2.title}\n${gift2.linkUrl}` : gift2.title,
                  inline: false
                },
                {
                  name: 'Gift 3',
                  value: gift3.linkUrl ? `${gift3.title}\n${gift3.linkUrl}` : gift3.title,
                  inline: false
                },
                {
                  name: 'Timestamp',
                  value: submission.pickedAt,
                  inline: false
                }
              ],
              footer: { text: 'Valentine Creator' }
            }
          ]
        })
      },
      5000
    ).catch(() => null);
  }

  res.status(200).json({ ok: true });
}
