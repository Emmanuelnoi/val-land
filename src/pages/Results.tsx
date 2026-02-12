import { useEffect, useState } from 'react';
import Card from '../components/Card';
import { fetchResults } from '../lib/api';
import type { ValentineSubmission } from '../lib/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { Link } from '../router';
import { DEFAULT_THEME, type ThemeKey } from '../lib/themes';
import { useTheme } from '../theme';

type ResultsProps = {
  slug: string;
  adminKey?: string;
};

type ResultsState = {
  toName: string;
  message: string;
  submissions: ValentineSubmission[];
  theme?: ThemeKey;
};

export default function Results({ slug, adminKey }: ResultsProps) {
  const { setTheme } = useTheme();
  const [activeKey, setActiveKey] = useState(() => adminKey ?? '');
  const [data, setData] = useState<ResultsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminKey) return;
    setActiveKey(adminKey);
  }, [adminKey]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      if (!activeKey) {
        setError('Invalid or missing key.');
        setLoading(false);
        return;
      }
      const result = await fetchResults(slug, activeKey);
      if (!isActive) return;
      if (!result.ok) {
        setError(result.error);
        setData(null);
        setTheme(DEFAULT_THEME);
      } else {
        setData(result.results);
        setTheme(result.results.theme ?? DEFAULT_THEME);
        if (typeof window !== 'undefined' && adminKey) {
          const url = new URL(window.location.href);
          url.searchParams.delete('key');
          url.hash = '';
          window.history.replaceState({}, '', `${url.pathname}${url.search}`);
        }
      }
      setLoading(false);
    };
    load();
    return () => {
      isActive = false;
    };
  }, [slug, activeKey, adminKey, setTheme]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <Card className="mx-auto w-full max-w-3xl">
          <div className="space-y-3">
            <div className="h-6 w-2/3 animate-pulse rounded-full bg-accent-soft-strong" />
            <div className="h-4 w-full animate-pulse rounded-full bg-accent-soft" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-accent-soft" />
          </div>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <Card className="mx-auto w-full max-w-3xl">
          <div className="flex items-start gap-3 text-sm text-accent-strong">
            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Invalid or missing key.</p>
              <p className="text-accent-muted">{error ?? 'Please check the link and try again.'}</p>
              <Link
                to="/create"
                className="mt-3 inline-flex text-sm font-semibold text-accent hover-text-accent-strong focus-ring touch-manipulation"
              >
                Create a New Gift Page
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const sorted = [...data.submissions].sort(
    (a, b) => new Date(b.pickedAt).getTime() - new Date(a.pickedAt).getTime()
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <span className="valentine-chip">Creator Results</span>
        <h1 className="mt-4 text-balance text-3xl font-semibold text-shadow-soft sm:text-4xl">
          <span className="text-rose-gradient">Selections for {data.toName}</span>
        </h1>
        <p className="mt-2 text-base text-ink-300/90">{data.message}</p>
      </div>

      {sorted.length === 0 ? (
        <Card className="bg-white/80">
          <p className="text-sm text-ink-400">No selections yet. Check back soon.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sorted.map((submission) => (
            <Card key={submission.id} className="bg-white/85">
              <div className="flex flex-col gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-300">
                  {new Date(submission.pickedAt).toLocaleString()}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {submission.pickedGifts.map((gift) => (
                    <div key={gift.id} className="flex items-start gap-3">
                      {gift.imageUrl ? (
                        <img
                          src={gift.imageUrl}
                          alt={gift.title}
                          width={64}
                          height={64}
                          className="h-16 w-16 rounded-xl object-cover"
                          loading="lazy"
                        />
                      ) : null}
                      <div>
                        <p className="text-sm font-semibold text-ink-500">{gift.title}</p>
                        {gift.linkUrl ? (
                          <a
                            href={gift.linkUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="link-soft mt-1 inline-flex items-center gap-2 focus-ring"
                          >
                            View link
                          </a>
                        ) : (
                          <p className="text-xs text-ink-300">No link provided</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
