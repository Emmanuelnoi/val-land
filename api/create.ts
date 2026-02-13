import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kvGet, kvSet } from '../src/server/kv.js';
import { logApiEvent } from '../src/server/observability.js';
import {
  createRateLimiter,
  encryptSecret,
  generateSlug,
  generateToken,
  getClientIp,
  hasValidChallenge,
  hashToken,
  isDiscordWebhook,
  sanitizePublicHttpsUrl,
  sanitizeText,
  sanitizeUrl,
  toSafeString
} from '../src/server/security.js';
import { normalizeThemeKey } from '../src/lib/themes.js';
import type { ThemeKey } from '../src/lib/themes.js';
import type { Gift } from '../src/lib/types.js';

type IncomingGift = Partial<Gift>;

type IncomingPayload = {
  toName?: string;
  message?: string;
  gifts?: IncomingGift[];
  creatorDiscordWebhookUrl?: string;
  theme?: string;
};

const limiter = createRateLimiter({
  max: 5,
  windowMs: 60 * 60 * 1000,
  minIntervalMs: 10_000,
  namespace: 'create',
  blockOnBackendFailure: true
});

function getBaseUrl(req: VercelRequest): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    const normalized = sanitizeUrl(configured);
    if (normalized) {
      return normalized.replace(/\/+$/, '');
    }
  }

  // Never trust forwarded host/proto in production; use APP_BASE_URL there.
  if (process.env.NODE_ENV === 'production') {
    return '';
  }

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
  const candidate = body as Record<string, unknown>;

  if (candidate.toName !== undefined && typeof candidate.toName !== 'string') return null;
  if (candidate.message !== undefined && typeof candidate.message !== 'string') return null;
  if (candidate.theme !== undefined && typeof candidate.theme !== 'string') return null;
  if (
    candidate.creatorDiscordWebhookUrl !== undefined &&
    typeof candidate.creatorDiscordWebhookUrl !== 'string'
  )
    return null;
  if (candidate.gifts !== undefined && !Array.isArray(candidate.gifts)) return null;

  const gifts = Array.isArray(candidate.gifts) ? candidate.gifts : undefined;
  if (gifts) {
    for (const gift of gifts) {
      if (!gift || typeof gift !== 'object') return null;
      const normalized = gift as Record<string, unknown>;
      if (normalized.id !== undefined && typeof normalized.id !== 'string') return null;
      if (normalized.title !== undefined && typeof normalized.title !== 'string') return null;
      if (normalized.description !== undefined && typeof normalized.description !== 'string') return null;
      if (normalized.imageUrl !== undefined && typeof normalized.imageUrl !== 'string') return null;
      if (normalized.linkUrl !== undefined && typeof normalized.linkUrl !== 'string') return null;
    }
  }

  return {
    toName: candidate.toName as string | undefined,
    message: candidate.message as string | undefined,
    gifts: gifts as IncomingGift[] | undefined,
    creatorDiscordWebhookUrl: candidate.creatorDiscordWebhookUrl as string | undefined,
    theme: candidate.theme as string | undefined
  };
}

function normalizeGift(gift: IncomingGift, index: number): Gift | null {
  const title = sanitizeText(gift.title ?? '', 60);
  const description = sanitizeText(gift.description ?? '', 140);
  const imageUrl = sanitizePublicHttpsUrl(gift.imageUrl);
  const linkUrl = sanitizePublicHttpsUrl(gift.linkUrl);
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
    logApiEvent(req, 'create.method_not_allowed', {}, 'warn');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');

  if (!hasValidChallenge(req)) {
    logApiEvent(req, 'create.challenge_failed', {}, 'warn');
    res.status(403).json({ ok: false, error: 'Challenge failed' });
    return;
  }

  const rate = await limiter(getClientIp(req));
  if (rate.limited) {
    logApiEvent(req, 'create.rate_limited', { retryAfter: rate.retryAfter }, 'warn');
    res.setHeader('Retry-After', rate.retryAfter.toString());
    res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    return;
  }

  const parsed = parsePayload(req.body);
  if (!parsed) {
    logApiEvent(req, 'create.invalid_payload', {}, 'warn');
    res.status(400).json({ ok: false, error: 'Invalid payload' });
    return;
  }

  const toName = sanitizeText(toSafeString(parsed.toName), 60);
  const message = sanitizeText(toSafeString(parsed.message), 180);
  const theme: ThemeKey = normalizeThemeKey(parsed.theme);

  if (!toName || !message) {
    logApiEvent(req, 'create.missing_required_fields', {}, 'warn');
    res.status(400).json({ ok: false, error: 'Name and message are required' });
    return;
  }

  const giftsInput = Array.isArray(parsed.gifts) ? parsed.gifts : [];
  if (giftsInput.length < 3 || giftsInput.length > 12) {
    logApiEvent(req, 'create.invalid_gift_count', { giftCount: giftsInput.length }, 'warn');
    res.status(400).json({ ok: false, error: 'Gifts must be between 3 and 12' });
    return;
  }

  const gifts: Gift[] = [];
  for (let i = 0; i < giftsInput.length; i += 1) {
    const normalized = normalizeGift(giftsInput[i], i);
    if (!normalized) {
      logApiEvent(req, 'create.invalid_gift_data', { giftIndex: i }, 'warn');
      res.status(400).json({ ok: false, error: 'Invalid gift data' });
      return;
    }
    gifts.push(normalized);
  }

  let creatorNotify: { type: 'discord'; webhookCiphertext: string } | undefined;
  if (parsed.creatorDiscordWebhookUrl) {
    const webhook = sanitizeUrl(parsed.creatorDiscordWebhookUrl);
    if (!webhook || !isDiscordWebhook(webhook)) {
      logApiEvent(req, 'create.invalid_discord_webhook', {}, 'warn');
      res.status(400).json({ ok: false, error: 'Invalid Discord webhook URL' });
      return;
    }
    const webhookCiphertext = encryptSecret(webhook);
    if (!webhookCiphertext) {
      logApiEvent(req, 'create.webhook_encryption_not_configured', {}, 'error');
      res.status(500).json({ ok: false, error: 'Server not configured' });
      return;
    }
    creatorNotify = { type: 'discord', webhookCiphertext };
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
      logApiEvent(req, 'create.slug_generation_failed', {}, 'error');
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
      adminTokenHash,
      theme
    });

    await kvSet(`val:subs:${slug}`, []);
  } catch (error) {
    logApiEvent(req, 'create.kv_error', {}, 'error');
    res.status(500).json({ ok: false, error: 'KV not configured' });
    return;
  }

  logApiEvent(req, 'create.success', {
    slug,
    theme,
    giftCount: gifts.length,
    creatorNotifyEnabled: Boolean(creatorNotify)
  });
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
      const path = `/v/${slug}/results#key=${adminToken}`;
      return baseUrl ? `${baseUrl}${path}` : path;
    })()
  });
}
