import type { SubmissionPayload } from './types';

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitSelection(
  payload: SubmissionPayload
): Promise<SubmitResult> {
  try {
    const response = await fetch('/api/valentine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };

    if (!response.ok || !data.ok) {
      return {
        ok: false,
        error: data.error ?? 'Submission failed'
      };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'Network error' };
  }
}
