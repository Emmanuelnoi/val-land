import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { encryptSecret, hashToken } from '../../src/server/security';

type MockResponse = VercelResponse & {
  statusCode: number;
  jsonBody?: unknown;
  headers: Record<string, string>;
};

const store = new Map<string, unknown>();

vi.mock('@upstash/redis', () => {
  class RedisMock {
    constructor(options: { url?: string; token?: string }) {
      if (!options?.url || !options?.token) {
        throw new Error('KV not configured');
      }
    }

    get = vi.fn(async (key: string) => store.get(key) ?? null);

    set = vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return 'OK';
    });

    incr = vi.fn(async (key: string) => {
      if (process.env.SIMULATE_REDIS_RATE_FAILURE === '1') {
        throw new Error('Redis unavailable');
      }
      const current = store.get(key);
      const next = typeof current === 'number' ? current + 1 : 1;
      store.set(key, next);
      return next;
    });

    expire = vi.fn(async () => 1);

    ttl = vi.fn(async () => 3600);
  }

  return { Redis: RedisMock };
});

function createMockRes(): MockResponse {
  const res = {
    statusCode: 200,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.jsonBody = body;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    }
  } as MockResponse;
  return res;
}

const baseGifts = [
  {
    id: 'gift-one',
    title: 'Gift One',
    description: 'First gift',
    imageUrl: 'https://example.com/one.jpg',
    linkUrl: 'https://example.com/one'
  },
  {
    id: 'gift-two',
    title: 'Gift Two',
    description: 'Second gift',
    imageUrl: 'https://example.com/two.jpg',
    linkUrl: 'https://example.com/two'
  },
  {
    id: 'gift-three',
    title: 'Gift Three',
    description: 'Third gift',
    imageUrl: 'https://example.com/three.jpg'
  }
];

beforeEach(() => {
  vi.resetModules();
  store.clear();
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.com/kv';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'kv-token';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.APP_BASE_URL;
  delete process.env.ANTI_ABUSE_CHALLENGE_TOKEN;
  delete process.env.HEALTHCHECK_TOKEN;
  delete process.env.CREATOR_NOTIFY_ENCRYPTION_KEY;
  delete process.env.SIMULATE_REDIS_RATE_FAILURE;
});

describe('creator flow api', () => {
  it('creates a valentine and returns absolute links', async () => {
    const handler = (await import('../../api/create')).default;
    const req = {
      method: 'POST',
      headers: {
        host: 'val.local',
        'x-forwarded-proto': 'https'
      },
      body: {
        toName: 'Bri',
        message: 'Be my valentine',
        gifts: baseGifts
      }
    } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);

    const body = res.jsonBody as {
      ok?: boolean;
      slug?: string;
      shareUrl?: string;
      resultsUrl?: string;
    };

    expect(body.ok).toBe(true);
    expect(body.slug).toBeDefined();
    expect(body.shareUrl).toMatch(/^https:\/\/val\.local\/v\//);
    expect(body.resultsUrl).toMatch(/^https:\/\/val\.local\/v\/.+\/results#key=/);
    expect(res.headers['Cache-Control']).toBe('no-store, private, max-age=0');

    const stored = store.get(`val:cfg:${body.slug}`) as {
      adminTokenHash: string;
      creatorNotify?: unknown;
    };
    expect(stored).toBeTruthy();
    expect(stored.creatorNotify).toBeUndefined();
    expect(stored.adminTokenHash).toBeDefined();

    const subs = store.get(`val:subs:${body.slug}`) as unknown[];
    expect(Array.isArray(subs)).toBe(true);
  });

  it('requires encryption key when creator webhook is provided', async () => {
    const handler = (await import('../../api/create')).default;
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-proto': 'https', host: 'val.local' },
      body: {
        toName: 'Bri',
        message: 'Be my valentine',
        gifts: baseGifts,
        creatorDiscordWebhookUrl: 'https://discord.com/api/webhooks/test/token'
      }
    } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toMatchObject({ ok: false, error: 'Server not configured' });
  });

  it('stores creator webhook encrypted when encryption key is configured', async () => {
    process.env.CREATOR_NOTIFY_ENCRYPTION_KEY = 'local-dev-encryption-key';
    const handler = (await import('../../api/create')).default;
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-proto': 'https', host: 'val.local' },
      body: {
        toName: 'Bri',
        message: 'Be my valentine',
        gifts: baseGifts,
        creatorDiscordWebhookUrl: 'https://discord.com/api/webhooks/test/token'
      }
    } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as { slug?: string };
    const stored = store.get(`val:cfg:${body.slug}`) as {
      creatorNotify?: { webhookCiphertext?: string; webhookUrl?: string };
    };
    expect(stored.creatorNotify?.webhookCiphertext?.startsWith('enc:v1:')).toBe(true);
    expect(stored.creatorNotify?.webhookUrl).toBeUndefined();
  });

  it('rejects malformed create payload types', async () => {
    const handler = (await import('../../api/create')).default;
    const req = {
      method: 'POST',
      headers: {},
      body: {
        toName: { nested: true },
        message: 'Hello',
        gifts: baseGifts
      }
    } as unknown as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toMatchObject({ ok: false, error: 'Invalid payload' });
  });

  it('rejects malformed submit payload types', async () => {
    store.set('val:cfg:abc123', {
      toName: 'Bri',
      message: 'Hello',
      gifts: baseGifts
    });
    store.set('val:subs:abc123', []);

    const handler = (await import('../../api/submit')).default;
    const req = {
      method: 'POST',
      headers: {},
      body: {
        slug: 'abc123',
        pickedGifts: [{ id: { bad: true } }, { id: 'gift-two' }, { id: 'gift-three' }]
      }
    } as unknown as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toMatchObject({ ok: false, error: 'Invalid payload' });
  });

  it('prefers APP_BASE_URL over forwarded headers', async () => {
    process.env.APP_BASE_URL = 'https://giftland.example/';
    const handler = (await import('../../api/create')).default;
    const req = {
      method: 'POST',
      headers: {
        host: 'attacker.example',
        'x-forwarded-proto': 'http'
      },
      body: {
        toName: 'Bri',
        message: 'Be my valentine',
        gifts: baseGifts
      }
    } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as { shareUrl?: string; resultsUrl?: string };
    expect(body.shareUrl).toMatch(/^https:\/\/giftland\.example\/v\//);
    expect(body.resultsUrl).toMatch(/^https:\/\/giftland\.example\/v\/.+\/results#key=/);
  });

  it('enforces anti-abuse challenge when configured', async () => {
    process.env.ANTI_ABUSE_CHALLENGE_TOKEN = 'challenge-secret';
    const handler = (await import('../../api/create')).default;
    const req = {
      method: 'POST',
      headers: {},
      body: {
        toName: 'Bri',
        message: 'Be my valentine',
        gifts: baseGifts
      }
    } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toMatchObject({ ok: false, error: 'Challenge failed' });
  });

  it('accepts anti-abuse challenge header when configured', async () => {
    process.env.ANTI_ABUSE_CHALLENGE_TOKEN = 'challenge-secret';
    const handler = (await import('../../api/create')).default;
    const req = {
      method: 'POST',
      headers: { 'x-app-challenge': 'challenge-secret' },
      body: {
        toName: 'Bri',
        message: 'Be my valentine',
        gifts: baseGifts
      }
    } as unknown as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('does not trust forwarded host in production without APP_BASE_URL', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.ANTI_ABUSE_CHALLENGE_TOKEN = 'challenge-secret';
    try {
      const handler = (await import('../../api/create')).default;
      const req = {
        method: 'POST',
        headers: {
          'x-app-challenge': 'challenge-secret',
          host: 'attacker.example',
          'x-forwarded-proto': 'http'
        },
        body: {
          toName: 'Bri',
          message: 'Be my valentine',
          gifts: baseGifts
        }
      } as VercelRequest;
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      const body = res.jsonBody as { shareUrl?: string; resultsUrl?: string };
      expect(body.shareUrl).toMatch(/^\/v\//);
      expect(body.resultsUrl).toMatch(/^\/v\/.+\/results#key=/);
    } finally {
      if (prevNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = prevNodeEnv;
      }
    }
  });

  it('fails closed when shared rate limiter backend errors in production', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.ANTI_ABUSE_CHALLENGE_TOKEN = 'challenge-secret';
    process.env.SIMULATE_REDIS_RATE_FAILURE = '1';
    try {
      const handler = (await import('../../api/create')).default;
      const req = {
        method: 'POST',
        headers: { 'x-app-challenge': 'challenge-secret' },
        body: {
          toName: 'Bri',
          message: 'Be my valentine',
          gifts: baseGifts
        }
      } as VercelRequest;
      const res = createMockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(429);
      expect(res.jsonBody).toMatchObject({ ok: false, error: 'Rate limit exceeded' });
    } finally {
      if (prevNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = prevNodeEnv;
      }
    }
  });

  it('returns only public config fields', async () => {
    store.set('val:cfg:abc123', {
      toName: 'Bri',
      message: 'Hello',
      gifts: baseGifts,
      createdAt: '2026-02-10T00:00:00.000Z',
      creatorNotify: { type: 'discord', webhookUrl: 'https://discord.com/api/webhooks/x' },
      adminTokenHash: 'secret'
    });

    const handler = (await import('../../api/config')).default;
    const req = { method: 'GET', headers: {}, query: { slug: 'abc123' } } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as {
      ok?: boolean;
      config?: Record<string, unknown>;
    };
    expect(body.ok).toBe(true);
    expect(body.config?.toName).toBe('Bri');
    expect(body.config?.message).toBe('Hello');
    expect(body.config?.creatorNotify).toBeUndefined();
    expect(body.config?.adminTokenHash).toBeUndefined();
  });

  it('rejects invalid stored config', async () => {
    store.set('val:cfg:bad123', {
      toName: 'Bri',
      message: 'Hello',
      gifts: [{ id: 'one', title: 'No image', description: 'Oops' }],
      createdAt: '2026-02-10T00:00:00.000Z'
    });

    const handler = (await import('../../api/config')).default;
    const req = { method: 'GET', headers: {}, query: { slug: 'bad123' } } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('submits picks and notifies creator webhook', async () => {
    process.env.CREATOR_NOTIFY_ENCRYPTION_KEY = 'local-dev-encryption-key';
    const encryptedWebhook = encryptSecret(
      'https://discord.com/api/webhooks/test',
      process.env.CREATOR_NOTIFY_ENCRYPTION_KEY
    );
    store.set('val:cfg:abc123', {
      toName: 'Bri',
      message: 'Hello',
      gifts: baseGifts,
      creatorNotify: { type: 'discord', webhookCiphertext: encryptedWebhook }
    });
    store.set('val:subs:abc123', []);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const handler = (await import('../../api/submit')).default;
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: {
        slug: 'abc123',
        pickedGifts: [
          { id: 'gift-one' },
          { id: 'gift-two' },
          { id: 'gift-three' }
        ]
      }
    } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const submissions = store.get('val:subs:abc123') as Array<{ pickedGifts: unknown[] }>;
    expect(submissions).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    const fieldNames = payload.embeds[0].fields.map((field: { name: string }) => field.name);
    expect(fieldNames).toContain('Gift 3');
  });

  it('returns results when the key is valid', async () => {
    const key = 'secret-key';
    store.set('val:cfg:abc123', {
      toName: 'Bri',
      message: 'Hello',
      adminTokenHash: hashToken(key)
    });
    store.set('val:subs:abc123', [
      {
        id: 'sub1',
        pickedAt: '2026-02-10T00:00:00.000Z',
        pickedGifts: baseGifts.slice(0, 3)
      }
    ]);

    const handler = (await import('../../api/results')).default;
    const req = {
      method: 'POST',
      headers: {},
      body: { slug: 'abc123', key }
    } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store, private, max-age=0');
    const body = res.jsonBody as { ok?: boolean; results?: { submissions?: unknown[] } };
    expect(body.ok).toBe(true);
    expect(body.results?.submissions).toHaveLength(1);
  });

  it('blocks health endpoint in production without token', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const handler = (await import('../../api/health/kv')).default;
      const req = {
        method: 'GET',
        headers: {}
      } as unknown as VercelRequest;
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(404);
    } finally {
      if (prevNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = prevNodeEnv;
      }
    }
  });

  it('allows health endpoint with valid token', async () => {
    process.env.HEALTHCHECK_TOKEN = 'health-secret';
    const handler = (await import('../../api/health/kv')).default;
    const req = {
      method: 'GET',
      headers: { 'x-healthcheck-token': 'health-secret' }
    } as unknown as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toMatchObject({ ok: true });
  });
});
