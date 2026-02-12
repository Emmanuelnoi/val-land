import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kvGet, kvSet } from '../../src/server/kv.js';
import { hashToken, timingSafeEqualHex } from '../../src/server/security.js';

function isAuthorized(req: VercelRequest) {
  const expected = process.env.HEALTHCHECK_TOKEN?.trim();
  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }

  const header = req.headers['x-healthcheck-token'];
  const provided = Array.isArray(header) ? header[0] : header;
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const expectedHash = hashToken(expected);
  const providedHash = hashToken(provided);
  return timingSafeEqualHex(expectedHash, providedHash);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    // Return not found to avoid disclosing operational endpoints.
    res.status(404).json({ ok: false, error: 'Not found' });
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
