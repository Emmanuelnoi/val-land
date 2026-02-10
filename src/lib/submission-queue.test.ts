import { describe, expect, it, vi } from 'vitest';
import {
  drainSubmissionQueue,
  enqueueFailedSubmission,
  getNextAttemptDelayMs,
  readSubmissionQueue
} from './submission-queue';
import type { SubmissionPayload } from './types';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    }
  };
}

const samplePayload = (name: string): SubmissionPayload => ({
  name,
  createdAt: '2026-02-10T00:00:00.000Z',
  gifts: [
    { id: 'one', title: 'Gift One', linkUrl: 'https://example.com/1' },
    { id: 'two', title: 'Gift Two', linkUrl: 'https://example.com/2' }
  ]
});

describe('submission queue', () => {
  it('caps the queue size', () => {
    const storage = createMemoryStorage();
    const now = new Date('2026-02-10T00:00:00.000Z');

    enqueueFailedSubmission(storage, samplePayload('A'), 'fail', { maxSize: 2, now });
    enqueueFailedSubmission(storage, samplePayload('B'), 'fail', {
      maxSize: 2,
      now: new Date(now.getTime() + 1000)
    });
    enqueueFailedSubmission(storage, samplePayload('C'), 'fail', {
      maxSize: 2,
      now: new Date(now.getTime() + 2000)
    });

    const entries = readSubmissionQueue(storage);
    expect(entries).toHaveLength(2);
    expect(entries[0].payload.name).toBe('B');
    expect(entries[1].payload.name).toBe('C');
  });

  it('drains successful submissions and retries failed ones', async () => {
    const storage = createMemoryStorage();
    const now = new Date('2026-02-10T00:00:00.000Z');

    enqueueFailedSubmission(storage, samplePayload('A'), 'fail', { now });

    const submitFn = vi.fn().mockResolvedValue({ ok: false, error: 'still down' });
    await drainSubmissionQueue(storage, submitFn, { now: new Date(now.getTime() + 60_000) });

    let entries = readSubmissionQueue(storage);
    expect(entries).toHaveLength(1);
    expect(entries[0].attempts).toBe(2);

    submitFn.mockResolvedValue({ ok: true });
    await drainSubmissionQueue(storage, submitFn, { now: new Date(now.getTime() + 120_000) });
    entries = readSubmissionQueue(storage);
    expect(entries).toHaveLength(0);
  });

  it('skips entries until their next attempt window', async () => {
    const storage = createMemoryStorage();
    const now = new Date('2026-02-10T00:00:00.000Z');

    enqueueFailedSubmission(storage, samplePayload('A'), 'fail', { now });
    const entries = readSubmissionQueue(storage);
    const delay = getNextAttemptDelayMs(entries, { now });
    expect(delay).toBeGreaterThan(0);

    const submitFn = vi.fn().mockResolvedValue({ ok: true });
    const result = await drainSubmissionQueue(storage, submitFn, { now });
    expect(result.processed).toBe(0);
    expect(readSubmissionQueue(storage)).toHaveLength(1);
  });
});
