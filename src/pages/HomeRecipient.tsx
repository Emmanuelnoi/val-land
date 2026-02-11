import { useEffect, useRef } from 'react';
import RecipientFlow from '../components/RecipientFlow';
import { gifts as giftData } from '../data/gifts';
import { recipientMessage, recipientName } from '../data/recipient';
import { submitSelection, type SubmitResult } from '../lib/api';
import type { SelectedGift, SubmissionPayload } from '../lib/types';
import {
  drainSubmissionQueue,
  enqueueFailedSubmission,
  getNextAttemptDelayMs,
  readSubmissionQueue
} from '../lib/submission-queue';

function getBrowserStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage ?? null;
}

export default function HomeRecipient() {
  const drainTimerRef = useRef<number | null>(null);
  const drainingRef = useRef(false);

  const scheduleDrain = (delayMs: number | null) => {
    if (delayMs == null) return;
    if (drainTimerRef.current) {
      window.clearTimeout(drainTimerRef.current);
    }
    drainTimerRef.current = window.setTimeout(() => {
      void runDrain();
    }, Math.max(1000, delayMs));
  };

  const runDrain = async () => {
    const storage = getBrowserStorage();
    if (!storage || drainingRef.current) return;
    drainingRef.current = true;
    try {
      const result = await drainSubmissionQueue(storage, submitSelection);
      scheduleDrain(result.nextAttemptDelayMs);
    } finally {
      drainingRef.current = false;
    }
  };

  const scheduleDrainFromStorage = () => {
    const storage = getBrowserStorage();
    if (!storage) return;
    const entries = readSubmissionQueue(storage);
    scheduleDrain(getNextAttemptDelayMs(entries));
  };

  useEffect(() => {
    void runDrain();
    return () => {
      if (drainTimerRef.current) {
        window.clearTimeout(drainTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (pickedGifts: SelectedGift[]): Promise<SubmitResult> => {
    const payload: SubmissionPayload = {
      name: recipientName,
      gifts: pickedGifts,
      createdAt: new Date().toISOString()
    };
    const result = await submitSelection(payload);
    if (!result.ok) {
      const storage = getBrowserStorage();
      if (storage) {
        enqueueFailedSubmission(storage, payload, result.error);
        scheduleDrainFromStorage();
        return { ok: false, error: 'Saved locally. Retry scheduled.' };
      }
      return result;
    }
    return result;
  };

  return (
    <RecipientFlow
      config={{ toName: recipientName, message: recipientMessage, gifts: giftData }}
      onSubmit={handleSubmit}
      showCreateLink
    />
  );
}
