import type { VercelRequest } from '@vercel/node';
import { getClientIp, hashToken } from './security.js';

type LogLevel = 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /(secret|token|key|password|webhook|cipher|authorization)/i;

function sanitizePrimitive(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    return value.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 240);
  }
  return String(value).slice(0, 240);
}

function sanitizeFields(fields: LogFields): LogFields {
  const sanitized: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[redacted]';
      continue;
    }
    sanitized[key] = sanitizePrimitive(value);
  }
  return sanitized;
}

function writeLog(level: LogLevel, payload: Record<string, unknown>) {
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.info(line);
}

function hashUserAgent(userAgent: string | string[] | undefined): string {
  const raw = Array.isArray(userAgent) ? userAgent[0] : userAgent;
  return hashToken(typeof raw === 'string' ? raw : '').slice(0, 16);
}

export function logEvent(event: string, fields: LogFields = {}, level: LogLevel = 'info') {
  writeLog(level, {
    ts: new Date().toISOString(),
    event,
    ...sanitizeFields(fields)
  });
}

export function logApiEvent(
  req: VercelRequest,
  event: string,
  fields: LogFields = {},
  level: LogLevel = 'info'
) {
  const path = typeof req.url === 'string' ? req.url.split('?')[0] : '';
  const ipHash = hashToken(getClientIp(req)).slice(0, 16);
  logEvent(
    event,
    {
      method: req.method ?? 'UNKNOWN',
      path,
      ipHash,
      uaHash: hashUserAgent(req.headers['user-agent']),
      ...fields
    },
    level
  );
}
