import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRateLimiter, getClientIp, sanitizeText } from '../src/server/security.js';
import { logApiEvent } from '../src/server/observability.js';

type TelemetryPayload = {
  event?: string;
  page?: string;
  endpoint?: string;
  status?: number;
  directive?: string;
  blockedHost?: string;
  sourceHost?: string;
  reason?: string;
};

const telemetryLimiter = createRateLimiter({
  max: 200,
  windowMs: 60 * 60 * 1000,
  minIntervalMs: 100,
  namespace: 'telemetry',
  blockOnBackendFailure: false
});

const ALLOWED_EVENTS = new Set([
  'challenge_failed_client',
  'challenge_fetch_failed_client',
  'image_load_error_client',
  'csp_violation_client'
]);

function sanitizeEventName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64);
}

function parsePayload(body: unknown): TelemetryPayload | null {
  if (!body || typeof body !== 'object') return null;
  const candidate = body as Record<string, unknown>;

  const event = sanitizeEventName(candidate.event);
  if (!event || !ALLOWED_EVENTS.has(event)) return null;

  return {
    event,
    page: typeof candidate.page === 'string' ? sanitizeText(candidate.page, 120) : undefined,
    endpoint:
      typeof candidate.endpoint === 'string' ? sanitizeText(candidate.endpoint, 120) : undefined,
    status: typeof candidate.status === 'number' ? candidate.status : undefined,
    directive:
      typeof candidate.directive === 'string' ? sanitizeText(candidate.directive, 120) : undefined,
    blockedHost:
      typeof candidate.blockedHost === 'string' ? sanitizeText(candidate.blockedHost, 120) : undefined,
    sourceHost:
      typeof candidate.sourceHost === 'string' ? sanitizeText(candidate.sourceHost, 120) : undefined,
    reason: typeof candidate.reason === 'string' ? sanitizeText(candidate.reason, 120) : undefined
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store, private, max-age=0');

  const rate = await telemetryLimiter(getClientIp(req));
  if (rate.limited) {
    res.status(202).json({ ok: true });
    return;
  }

  const parsed = parsePayload(req.body);
  if (!parsed) {
    res.status(400).json({ ok: false, error: 'Invalid payload' });
    return;
  }

  logApiEvent(
    req,
    `client.${parsed.event}`,
    {
      page: parsed.page,
      endpoint: parsed.endpoint,
      status: parsed.status,
      directive: parsed.directive,
      blockedHost: parsed.blockedHost,
      sourceHost: parsed.sourceHost,
      reason: parsed.reason
    },
    'warn'
  );

  res.status(202).json({ ok: true });
}
