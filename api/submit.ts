import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { kvAppend, kvGet } from '../src/server/kv.js';
import {
  createRateLimiter,
  getClientIp,
  isValidSlug,
  sanitizeText,
  sanitizeUrl
} from '../src/server/security.js';
import type { Gift, SelectedGift } from '../src/lib/types.js';

type IncomingPayload = {
  slug?: string;
  pickedGifts?: Array<{ id?: string }>;
};

const limiter = createRateLimiter({
  max: 20,
  windowMs: 60 * 60 * 1000,
  minIntervalMs: 3000
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
  return body as IncomingPayload;
}

function pickGift(configGifts: Gift[], id: string): SelectedGift | null {
  const match = configGifts.find((gift) => gift.id === id);
  if (!match) return null;
  const imageUrl = sanitizeUrl(match.imageUrl);
  if (!imageUrl) return null;
  return {
    id: match.id,
    title: sanitizeText(match.title, 60),
    linkUrl: sanitizeUrl(match.linkUrl),
    imageUrl
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
        creatorNotify?: { type: 'discord'; webhookUrl: string };
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
    const id = sanitizeText(pick?.id ?? '', 40);
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

  if (config.creatorNotify?.type === 'discord' && config.creatorNotify.webhookUrl) {
    const [gift1, gift2, gift3] = pickedGifts;
    await fetchWithTimeout(
      config.creatorNotify.webhookUrl,
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
