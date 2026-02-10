import type { SubmissionPayload } from './types';
import type { SubmitResult } from './api';

export const SUBMISSION_QUEUE_KEY = 'valentineSubmissionQueue';

export type QueueEntry = {
  payload: SubmissionPayload;
  error: string;
  queuedAt: string;
  attempts: number;
  nextAttemptAt: string;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type QueueOptions = {
  key?: string;
  maxSize?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  now?: Date;
};

const DEFAULT_MAX_SIZE = 10;
const DEFAULT_BASE_DELAY_MS = 20_000;
const DEFAULT_MAX_DELAY_MS = 5 * 60_000;

function getNow(options?: QueueOptions) {
  return options?.now ?? new Date();
}

function getKey(options?: QueueOptions) {
  return options?.key ?? SUBMISSION_QUEUE_KEY;
}

function getBackoffDelayMs(attempts: number, options?: QueueOptions) {
  const base = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const max = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const delay = base * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(delay, max);
}

function normalizeEntries(entries: unknown[]): QueueEntry[] {
  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => entry as Partial<QueueEntry>)
    .filter((entry) => typeof entry.payload === 'object' && typeof entry.queuedAt === 'string')
    .map((entry) => ({
      payload: entry.payload as SubmissionPayload,
      error: typeof entry.error === 'string' ? entry.error : 'Submission failed',
      queuedAt: entry.queuedAt as string,
      attempts: typeof entry.attempts === 'number' ? entry.attempts : 1,
      nextAttemptAt:
        typeof entry.nextAttemptAt === 'string' ? entry.nextAttemptAt : new Date().toISOString()
    }));
}

export function readSubmissionQueue(storage: StorageLike, options?: QueueOptions): QueueEntry[] {
  const key = getKey(options);
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeEntries(parsed);
  } catch (error) {
    return [];
  }
}

export function writeSubmissionQueue(
  storage: StorageLike,
  entries: QueueEntry[],
  options?: QueueOptions
) {
  const key = getKey(options);
  try {
    if (entries.length === 0) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, JSON.stringify(entries));
  } catch (error) {
    // Best-effort storage; ignore write failures.
  }
}

export function enqueueFailedSubmission(
  storage: StorageLike,
  payload: SubmissionPayload,
  errorMessage: string,
  options?: QueueOptions
) {
  const now = getNow(options);
  const entries = readSubmissionQueue(storage, options);
  const attempts = 1;
  const nextAttemptAt = new Date(now.getTime() + getBackoffDelayMs(attempts, options)).toISOString();

  const nextEntries = [
    ...entries,
    {
      payload,
      error: errorMessage,
      queuedAt: now.toISOString(),
      attempts,
      nextAttemptAt
    }
  ];

  const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;
  const capped = nextEntries.length > maxSize ? nextEntries.slice(-maxSize) : nextEntries;
  writeSubmissionQueue(storage, capped, options);
  return capped;
}

export function getNextAttemptDelayMs(entries: QueueEntry[], options?: QueueOptions): number | null {
  const now = getNow(options).getTime();
  const upcoming = entries
    .map((entry) => new Date(entry.nextAttemptAt).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp));
  if (upcoming.length === 0) return null;
  const nextTime = Math.min(...upcoming);
  return Math.max(0, nextTime - now);
}

export async function drainSubmissionQueue(
  storage: StorageLike,
  submitFn: (payload: SubmissionPayload) => Promise<SubmitResult>,
  options?: QueueOptions
) {
  const now = getNow(options);
  const entries = readSubmissionQueue(storage, options);
  if (entries.length === 0) {
    return { processed: 0, remaining: 0, nextAttemptDelayMs: null };
  }

  const remaining: QueueEntry[] = [];
  let processed = 0;

  for (const entry of entries) {
    const nextAttempt = new Date(entry.nextAttemptAt).getTime();
    if (!Number.isNaN(nextAttempt) && nextAttempt > now.getTime()) {
      remaining.push(entry);
      continue;
    }

    processed += 1;
    let result: SubmitResult;
    try {
      result = await submitFn(entry.payload);
    } catch (error) {
      result = { ok: false, error: 'Network error' };
    }
    if (result.ok) {
      continue;
    }

    const attempts = (entry.attempts ?? 1) + 1;
    const nextAttemptAt = new Date(
      now.getTime() + getBackoffDelayMs(attempts, options)
    ).toISOString();
    remaining.push({
      ...entry,
      attempts,
      error: result.error,
      nextAttemptAt
    });
  }

  writeSubmissionQueue(storage, remaining, options);
  const nextAttemptDelayMs = getNextAttemptDelayMs(remaining, { ...options, now });
  return { processed, remaining: remaining.length, nextAttemptDelayMs };
}
