import crypto from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

export type RateLimitConfig = {
  max: number;
  windowMs: number;
  minIntervalMs: number;
};

type RateEntry = {
  count: number;
  firstAt: number;
  lastAt: number;
};

const RATE_STORE_TTL_MS = 2 * 60 * 60 * 1000;
const RATE_STORE_MAX = 2000;

function pruneRateStore(store: Map<string, RateEntry>, now: number) {
  for (const [key, entry] of store.entries()) {
    if (now - entry.lastAt > RATE_STORE_TTL_MS) {
      store.delete(key);
    }
  }
  if (store.size <= RATE_STORE_MAX) return;
  const sorted = Array.from(store.entries()).sort((a, b) => a[1].lastAt - b[1].lastAt);
  const overflow = store.size - RATE_STORE_MAX;
  for (let i = 0; i < overflow; i += 1) {
    store.delete(sorted[i][0]);
  }
}

export function createRateLimiter(config: RateLimitConfig) {
  const store = new Map<string, RateEntry>();

  return (ip: string): { limited: boolean; retryAfter: number } => {
    const now = Date.now();
    pruneRateStore(store, now);
    const entry = store.get(ip);

    if (!entry || now - entry.firstAt > config.windowMs) {
      store.set(ip, { count: 0, firstAt: now, lastAt: 0 });
    }

    const active = store.get(ip)!;
    const sinceLast = active.lastAt ? now - active.lastAt : Number.POSITIVE_INFINITY;
    if (sinceLast < config.minIntervalMs) {
      return { limited: true, retryAfter: Math.ceil((config.minIntervalMs - sinceLast) / 1000) };
    }

    if (active.count >= config.max) {
      const windowRemaining = config.windowMs - (now - active.firstAt);
      return { limited: true, retryAfter: Math.ceil(windowRemaining / 1000) };
    }

    active.count += 1;
    active.lastAt = now;
    store.set(ip, active);

    return { limited: false, retryAfter: 0 };
  };
}

export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

export function sanitizeText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\[\]()_*~`>#|<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch (error) {
    return undefined;
  }
}

export function isDiscordWebhook(url: string) {
  return (
    url.startsWith('https://discord.com/api/webhooks/') ||
    url.startsWith('https://discordapp.com/api/webhooks/')
  );
}

export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateSlug(length = 8) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((byte) => SLUG_ALPHABET[byte % SLUG_ALPHABET.length])
    .join('');
}

export function isValidSlug(value: string) {
  return /^[a-z0-9]{6,12}$/.test(value);
}
