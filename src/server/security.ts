import crypto from 'node:crypto';
import { isIP } from 'node:net';
import type { VercelRequest } from '@vercel/node';
import { Redis } from '@upstash/redis';

export type RateLimitConfig = {
  max: number;
  windowMs: number;
  minIntervalMs: number;
  namespace: string;
  blockOnBackendFailure?: boolean;
};

type RateEntry = {
  count: number;
  firstAt: number;
  lastAt: number;
};

const RATE_STORE_TTL_MS = 2 * 60 * 60 * 1000;
const RATE_STORE_MAX = 2000;
const SHARED_LAST_KEY_TTL_SECONDS = 2 * 60 * 60;

let rateRedis: Redis | null = null;

function getRateRedis(): Redis | null {
  if (rateRedis) return rateRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  rateRedis = new Redis({ url, token });
  return rateRedis;
}

function toRateKeyFragment(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9:._-]/g, '-')
    .slice(0, 120);
  return normalized || 'unknown';
}

function normalizeIpCandidate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  // Normalize common "::ffff:1.2.3.4" representation.
  if (trimmed.startsWith('::ffff:')) {
    const mapped = trimmed.slice('::ffff:'.length);
    if (isIP(mapped) === 4) return mapped;
  }

  // Strip brackets from "[::1]".
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const unwrapped = trimmed.slice(1, -1);
    if (isIP(unwrapped)) return unwrapped;
  }

  // Strip ":port" only for IPv4 candidates.
  const colonCount = (trimmed.match(/:/g) ?? []).length;
  if (colonCount === 1 && trimmed.includes('.')) {
    const [host] = trimmed.split(':');
    if (isIP(host) === 4) return host;
  }

  return trimmed;
}

function extractFirstValidIp(header: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(header) ? header.join(',') : header;
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const candidates = raw.split(',').map((part) => normalizeIpCandidate(part));
  return candidates.find((candidate) => isIP(candidate) > 0);
}

async function runSharedRateLimit(ip: string, config: RateLimitConfig) {
  const redis = getRateRedis();
  if (!redis) return null;
  const now = Date.now();
  const ipKey = toRateKeyFragment(ip);
  const namespaceKey = toRateKeyFragment(config.namespace);
  const counterKey = `rl:${namespaceKey}:${ipKey}:count`;
  const lastKey = `rl:${namespaceKey}:${ipKey}:last`;
  const windowSeconds = Math.max(1, Math.ceil(config.windowMs / 1000));
  const minIntervalSeconds = Math.max(
    SHARED_LAST_KEY_TTL_SECONDS,
    Math.ceil(config.minIntervalMs / 1000)
  );

  try {
    const last = await redis.get<number>(lastKey);
    if (typeof last === 'number') {
      const sinceLast = now - last;
      if (sinceLast < config.minIntervalMs) {
        return {
          limited: true,
          retryAfter: Math.ceil((config.minIntervalMs - sinceLast) / 1000)
        };
      }
    }

    const count = await redis.incr(counterKey);
    if (count === 1) {
      await redis.expire(counterKey, windowSeconds);
    }
    await redis.set(lastKey, now, { ex: minIntervalSeconds });

    if (count > config.max) {
      const ttl = await redis.ttl(counterKey);
      return {
        limited: true,
        retryAfter: typeof ttl === 'number' && ttl > 0 ? ttl : windowSeconds
      };
    }

    return { limited: false, retryAfter: 0 };
  } catch (error) {
    return { backendUnavailable: true as const };
  }
}

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

  return async (ip: string): Promise<{ limited: boolean; retryAfter: number }> => {
    const shared = await runSharedRateLimit(ip, config);
    if (shared && 'backendUnavailable' in shared) {
      if (config.blockOnBackendFailure && process.env.NODE_ENV === 'production') {
        return { limited: true, retryAfter: 60 };
      }
    } else if (shared) {
      return shared;
    }

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
  const runningOnVercel = typeof req.headers['x-vercel-id'] === 'string';
  const allowForwardedHeaders = process.env.NODE_ENV !== 'production' || runningOnVercel;

  if (allowForwardedHeaders) {
    const realIp = extractFirstValidIp(req.headers['x-real-ip']);
    if (realIp) return realIp;

    const forwarded = extractFirstValidIp(req.headers['x-forwarded-for']);
    if (forwarded) return forwarded;
  }

  const remote = normalizeIpCandidate(req.socket?.remoteAddress ?? '');
  if (isIP(remote) > 0) return remote;
  return 'unknown';
}

export function sanitizeText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\[\]()_*~`>#|<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
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

function isPrivateOrLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local')
  ) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const parts = normalized.split('.').map((part) => Number.parseInt(part, 10));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  if (ipVersion === 6) {
    if (normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
    if (
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    )
      return true; // link-local fe80::/10
  }

  return false;
}

export function sanitizePublicHttpsUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return undefined;
    if (isPrivateOrLocalHostname(url.hostname)) return undefined;
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

function hashUserAgent(header: string | string[] | undefined): string {
  const raw = Array.isArray(header) ? header[0] : header;
  const normalized = typeof raw === 'string' ? raw.slice(0, 512) : '';
  return hashToken(normalized);
}

function signChallengePayload(payloadRaw: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadRaw).digest('base64url');
}

type SignedChallengePayload = {
  ip: string;
  ua: string;
  exp: number;
};

export function createSignedChallenge(req: VercelRequest, ttlSeconds = 300): string | undefined {
  const secret = process.env.ANTI_ABUSE_CHALLENGE_TOKEN?.trim();
  if (!secret) return undefined;

  const payload: SignedChallengePayload = {
    ip: getClientIp(req),
    ua: hashUserAgent(req.headers['user-agent']),
    exp: Date.now() + ttlSeconds * 1000
  };

  const payloadRaw = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signChallengePayload(payloadRaw, secret);
  return `v1.${payloadRaw}.${signature}`;
}

function verifySignedChallenge(req: VercelRequest, provided: string, secret: string): boolean {
  const parts = provided.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;

  const payloadRaw = parts[1];
  const providedSig = parts[2];
  const expectedSig = signChallengePayload(payloadRaw, secret);
  if (!timingSafeEqualHex(hashToken(providedSig), hashToken(expectedSig))) return false;

  let payload: SignedChallengePayload;
  try {
    payload = JSON.parse(Buffer.from(payloadRaw, 'base64url').toString('utf8')) as SignedChallengePayload;
  } catch (error) {
    return false;
  }

  if (!payload || typeof payload.exp !== 'number' || typeof payload.ip !== 'string' || typeof payload.ua !== 'string') {
    return false;
  }
  if (Date.now() > payload.exp) return false;
  if (payload.ip !== getClientIp(req)) return false;
  if (payload.ua !== hashUserAgent(req.headers['user-agent'])) return false;
  return true;
}

function getEncryptionKey(keyMaterial?: string): Buffer | null {
  const value = keyMaterial?.trim() ?? process.env.CREATOR_NOTIFY_ENCRYPTION_KEY?.trim() ?? '';
  if (!value) return null;
  return crypto.createHash('sha256').update(value).digest();
}

export function encryptSecret(value: string, keyMaterial?: string): string | undefined {
  const key = getEncryptionKey(keyMaterial);
  if (!key) return undefined;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string, keyMaterial?: string): string | undefined {
  const key = getEncryptionKey(keyMaterial);
  if (!key) return undefined;

  const parts = value.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') return undefined;

  try {
    const iv = Buffer.from(parts[2], 'base64url');
    const authTag = Buffer.from(parts[3], 'base64url');
    const encrypted = Buffer.from(parts[4], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    return undefined;
  }
}

export function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export function hasValidChallenge(req: VercelRequest): boolean {
  const expected = process.env.ANTI_ABUSE_CHALLENGE_TOKEN?.trim();
  if (!expected) return process.env.NODE_ENV !== 'production';
  const header = req.headers['x-app-challenge'];
  const provided = Array.isArray(header) ? header[0] : header;
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const providedHash = hashToken(provided);
  const expectedHash = hashToken(expected);
  if (timingSafeEqualHex(providedHash, expectedHash)) return true;
  return verifySignedChallenge(req, provided, expected);
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
