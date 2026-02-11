import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kvGet, kvSet } from '../../src/server/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const key = 'val:healthcheck';
  const timestamp = new Date().toISOString();

  try {
    await kvSet(key, { ok: true, checkedAt: timestamp });
    const value = await kvGet<{ ok: boolean; checkedAt: string }>(key);
    res.status(200).json({ ok: true, value });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'KV not configured' });
  }
}
