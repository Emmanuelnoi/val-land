import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kvGet } from '../src/server/kv.js';
import {
  createRateLimiter,
  getClientIp,
  isValidSlug,
  sanitizePublicHttpsUrl,
  sanitizeText
} from '../src/server/security.js';
import { normalizeThemeKey } from '../src/lib/themes.js';
import type { ThemeKey } from '../src/lib/themes.js';
import type { Gift, ValentinePublicConfig } from '../src/lib/types.js';

const limiter = createRateLimiter({
  max: 60,
  windowMs: 10 * 60 * 1000,
  minIntervalMs: 500,
  namespace: 'config-read'
});

type StoredConfig = {
  toName?: unknown;
  message?: unknown;
  gifts?: unknown;
  createdAt?: unknown;
  theme?: unknown;
};

function normalizeConfig(value: StoredConfig): ValentinePublicConfig | null {
  const toNameRaw = typeof value.toName === 'string' ? value.toName : '';
  const messageRaw = typeof value.message === 'string' ? value.message : '';
  const toName = sanitizeText(toNameRaw, 60);
  const message = sanitizeText(messageRaw, 180);
  if (!toName || !message) return null;

  const giftsRaw = Array.isArray(value.gifts) ? value.gifts : [];
  const gifts: Gift[] = [];
  for (const entry of giftsRaw) {
    if (!entry || typeof entry !== 'object') return null;
    const candidate = entry as Record<string, unknown>;
    const title = sanitizeText(typeof candidate.title === 'string' ? candidate.title : '', 60);
    const description = sanitizeText(
      typeof candidate.description === 'string' ? candidate.description : '',
      140
    );
    const imageUrl = sanitizePublicHttpsUrl(
      typeof candidate.imageUrl === 'string' ? candidate.imageUrl : undefined
    );
    const linkUrl = sanitizePublicHttpsUrl(
      typeof candidate.linkUrl === 'string' ? candidate.linkUrl : undefined
    );
    const id = sanitizeText(typeof candidate.id === 'string' ? candidate.id : '', 40)
      .toLowerCase()
      .replace(/\s+/g, '-');

    if (!title || !description || !imageUrl) return null;

    gifts.push({
      id: id || `gift-${gifts.length + 1}`,
      title,
      description,
      imageUrl,
      linkUrl
    });
  }

  if (gifts.length < 3) return null;

  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  const themeRaw = typeof value.theme === 'string' ? value.theme : '';
  const theme: ThemeKey = normalizeThemeKey(themeRaw);

  return {
    toName,
    message,
    gifts,
    createdAt,
    theme
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const rate = await limiter(getClientIp(req));
  if (rate.limited) {
    res.setHeader('Retry-After', rate.retryAfter.toString());
    res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    return;
  }

  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  if (!isValidSlug(slug)) {
    res.status(400).json({ ok: false, error: 'Invalid slug' });
    return;
  }

  let config: StoredConfig | null;
  try {
    config = await kvGet(`val:cfg:${slug}`);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'KV not configured' });
    return;
  }

  const publicConfig = config ? normalizeConfig(config) : null;

  if (!publicConfig) {
    res.status(404).json({ ok: false, error: 'Not found' });
    return;
  }

  res.status(200).json({
    ok: true,
    config: publicConfig
  });
}
