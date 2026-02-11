import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hashToken } from '../../src/server/security';

type MockResponse = VercelResponse & {
  statusCode: number;
  jsonBody?: unknown;
  headers: Record<string, string>;
};

const store = new Map<string, unknown>();

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
}

vi.mock('@upstash/redis', () => ({ Redis: RedisMock }));

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
    expect(body.resultsUrl).toMatch(/^https:\/\/val\.local\/v\/.+\/results\?key=/);

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
    store.set('val:cfg:abc123', {
      toName: 'Bri',
      message: 'Hello',
      gifts: baseGifts,
      creatorNotify: { type: 'discord', webhookUrl: 'https://discord.com/api/webhooks/test' }
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
      method: 'GET',
      headers: {},
      query: { slug: 'abc123', key }
    } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as { ok?: boolean; results?: { submissions?: unknown[] } };
    expect(body.ok).toBe(true);
    expect(body.results?.submissions).toHaveLength(1);
  });
});
