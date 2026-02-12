import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

type MockResponse = VercelResponse & {
  statusCode: number;
  jsonBody?: unknown;
  headers: Record<string, string>;
};

const basePayload = {
  name: 'Bri',
  gifts: [
    { id: 'one', title: 'Gift One', linkUrl: 'https://example.com/1' },
    { id: 'two', title: 'Gift Two', linkUrl: 'https://example.com/2' },
    { id: 'three', title: 'Gift Three', linkUrl: 'https://example.com/3' }
  ],
  createdAt: '2026-02-10T00:00:00.000Z'
};

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

async function loadHandler() {
  const module = await import('../../api/valentine');
  return module.default;
}

beforeEach(() => {
  vi.resetModules();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.DISCORD_WEBHOOK_URL;
});

describe('valentine api', () => {
  it('rejects non-POST requests', async () => {
    const handler = await loadHandler();
    const req = { method: 'GET', headers: {}, body: {} } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects invalid payloads', async () => {
    const handler = await loadHandler();
    const req = { method: 'POST', headers: {}, body: { gifts: 'nope' } } as VercelRequest;
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('enforces minimum interval between requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T00:00:00.000Z'));

    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: basePayload
    } as VercelRequest;

    const res1 = createMockRes();
    await handler(req, res1);
    expect(res1.statusCode).toBe(200);

    vi.setSystemTime(new Date('2026-02-10T00:00:05.000Z'));
    const res2 = createMockRes();
    await handler(req, res2);
    expect(res2.statusCode).toBe(429);
    expect(res2.headers['Retry-After']).toBeDefined();
  });

  it('enforces max requests per window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T00:00:00.000Z'));

    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '5.6.7.8' },
      body: basePayload
    } as VercelRequest;

    for (let i = 0; i < 5; i += 1) {
      const res = createMockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      vi.setSystemTime(new Date(`2026-02-10T00:00:${10 * (i + 1)}.000Z`));
    }

    const res6 = createMockRes();
    await handler(req, res6);
    expect(res6.statusCode).toBe(429);
  });
});
