import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kvGet } from '../src/server/kv';
import { hashToken, isValidSlug, timingSafeEqualHex } from '../src/server/security';
import type { ValentineSubmission } from '../src/lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  const key = typeof req.query.key === 'string' ? req.query.key : '';

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

  res.status(200).json({
    ok: true,
    results: {
      toName: config.toName,
      message: config.message,
      submissions
    }
  });
}
