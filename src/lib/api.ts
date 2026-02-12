import type {
  SelectedGift,
  SubmissionPayload,
  ValentineCreatePayload,
  ValentineCreateResult,
  ValentinePublicConfig,
  ValentineSubmission
} from './types';
import type { ThemeKey } from './themes';

export type SubmitResult = { ok: true } | { ok: false; error: string };

export type ApiResult<T> = { ok: true; result: T } | { ok: false; error: string };

export type ConfigResult =
  | { ok: true; config: ValentinePublicConfig }
  | { ok: false; error: string };

export type ResultsResult =
  | {
      ok: true;
      results: {
        toName: string;
        message: string;
        submissions: ValentineSubmission[];
        theme?: ThemeKey;
      };
    }
  | { ok: false; error: string };

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

export async function createValentine(
  payload: ValentineCreatePayload
): Promise<ApiResult<ValentineCreateResult>> {
  try {
    const response = await fetch('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      slug?: string;
      shareUrl?: string;
      resultsUrl?: string;
    };

    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Failed to create gift page' };
    }

    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const normalizeUrl = (value: string) => {
      if (!value) return value;
      if (value.startsWith('/') && origin) return `${origin}${value}`;
      return value;
    };

    return {
      ok: true,
      result: {
        slug: data.slug ?? '',
        shareUrl: normalizeUrl(data.shareUrl ?? ''),
        resultsUrl: normalizeUrl(data.resultsUrl ?? '')
      }
    };
  } catch (error) {
    return { ok: false, error: 'Network error' };
  }
}

export async function fetchConfig(slug: string): Promise<ConfigResult> {
  try {
    const response = await fetch(`/api/config?slug=${encodeURIComponent(slug)}`);
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      config?: ValentinePublicConfig;
    };

    if (!response.ok || !data.ok || !data.config) {
      return { ok: false, error: data.error ?? 'Config not found' };
    }

    return { ok: true, config: data.config };
  } catch (error) {
    return { ok: false, error: 'Network error' };
  }
}

export async function submitBySlug(
  slug: string,
  pickedGifts: SelectedGift[]
): Promise<SubmitResult> {
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, pickedGifts })
    });

    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Submission failed' };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'Network error' };
  }
}

export async function fetchResults(slug: string, key: string): Promise<ResultsResult> {
  try {
    const response = await fetch(
      `/api/results?slug=${encodeURIComponent(slug)}&key=${encodeURIComponent(key)}`
    );
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      results?: { toName: string; message: string; submissions: ValentineSubmission[] };
    };

    if (!response.ok || !data.ok || !data.results) {
      return { ok: false, error: data.error ?? 'Results unavailable' };
    }

    return { ok: true, results: data.results };
  } catch (error) {
    return { ok: false, error: 'Network error' };
  }
}
