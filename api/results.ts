import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kvGet } from '../src/server/kv.js';
import {
  createRateLimiter,
  getClientIp,
  hashToken,
  isValidSlug,
  timingSafeEqualHex
} from '../src/server/security.js';
import { DEFAULT_THEME, normalizeThemeKey } from '../src/lib/themes.js';
import type { ThemeKey } from '../src/lib/themes.js';
import type { ValentineSubmission } from '../src/lib/types.js';

type IncomingPayload = {
  slug?: string;
  key?: string;
};

const readLimiter = createRateLimiter({
  max: 20,
  windowMs: 10 * 60 * 1000,
  minIntervalMs: 2000,
  namespace: 'results-read',
  blockOnBackendFailure: true
});

const failedKeyLimiter = createRateLimiter({
  max: 8,
  windowMs: 10 * 60 * 1000,
  minIntervalMs: 500,
  namespace: 'results-failed-key',
  blockOnBackendFailure: true
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');

  const ip = getClientIp(req);
  const readRate = await readLimiter(ip);
  if (readRate.limited) {
    res.setHeader('Retry-After', readRate.retryAfter.toString());
    res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    return;
  }

  const body = req.body as IncomingPayload | undefined;
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const key = typeof body?.key === 'string' ? body.key : '';

  if (!isValidSlug(slug)) {
    res.status(400).json({ ok: false, error: 'Invalid slug' });
    return;
  }

  if (!key) {
    res.status(401).json({ ok: false, error: 'Invalid or missing key' });
    return;
  }

  let config:
    | {
        toName: string;
        message: string;
        adminTokenHash: string;
        theme?: string;
      }
    | null;
  try {
    config = await kvGet(`val:cfg:${slug}`);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'KV not configured' });
    return;
  }

  if (!config) {
    res.status(404).json({ ok: false, error: 'Not found' });
    return;
  }

  const hashed = hashToken(key);
  if (!timingSafeEqualHex(config.adminTokenHash, hashed)) {
    const failedKeyRate = await failedKeyLimiter(`${ip}:${slug}`);
    if (failedKeyRate.limited) {
      res.setHeader('Retry-After', failedKeyRate.retryAfter.toString());
      res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
      return;
    }
    res.status(401).json({ ok: false, error: 'Invalid or missing key' });
    return;
  }

  let submissions: ValentineSubmission[] = [];
  try {
    submissions = (await kvGet<ValentineSubmission[]>(`val:subs:${slug}`)) ?? [];
  } catch (error) {
    res.status(500).json({ ok: false, error: 'KV not configured' });
    return;
  }

  const theme: ThemeKey = normalizeThemeKey(config.theme ?? DEFAULT_THEME);

  res.status(200).json({
    ok: true,
    results: {
      toName: config.toName,
      message: config.message,
      submissions,
      theme
    }
  });
}
