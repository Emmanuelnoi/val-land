import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRateLimiter, createSignedChallenge, getClientIp } from '../src/server/security.js';
import { logApiEvent } from '../src/server/observability.js';

const challengeLimiter = createRateLimiter({
  max: 30,
  windowMs: 10 * 60 * 1000,
  minIntervalMs: 1000,
  namespace: 'challenge',
  blockOnBackendFailure: true
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    logApiEvent(req, 'challenge.method_not_allowed', {}, 'warn');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store, private, max-age=0');

  const rate = await challengeLimiter(getClientIp(req));
  if (rate.limited) {
    logApiEvent(req, 'challenge.rate_limited', { retryAfter: rate.retryAfter }, 'warn');
    res.setHeader('Retry-After', rate.retryAfter.toString());
    res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    return;
  }

  const challenge = createSignedChallenge(req, 5 * 60);
  if (!challenge) {
    if (process.env.NODE_ENV !== 'production') {
      logApiEvent(req, 'challenge.disabled_non_prod');
      res.status(200).json({ ok: true, challenge: null, expiresIn: 0 });
      return;
    }
    logApiEvent(req, 'challenge.misconfigured', {}, 'error');
    res.status(500).json({ ok: false, error: 'Server not configured' });
    return;
  }

  logApiEvent(req, 'challenge.issued');
  res.status(200).json({ ok: true, challenge, expiresIn: 300 });
}
