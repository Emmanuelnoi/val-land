import { useEffect, useState } from 'react';
import RecipientFlow from '../components/RecipientFlow';
import { fetchConfig, submitBySlug, type SubmitResult } from '../lib/api';
import type { SelectedGift, ValentinePublicConfig } from '../lib/types';
import Card from '../components/Card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { DEFAULT_THEME } from '../lib/themes';
import { useTheme } from '../theme';

type RecipientBySlugProps = {
  slug: string;
};

export default function RecipientBySlug({ slug }: RecipientBySlugProps) {
  const { setTheme } = useTheme();
  const [config, setConfig] = useState<ValentinePublicConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await fetchConfig(slug);
      if (!isActive) return;
      if (!result.ok) {
        setError(result.error);
        setConfig(null);
        setTheme(DEFAULT_THEME);
      } else {
        setConfig(result.config);
        setTheme(result.config.theme ?? DEFAULT_THEME);
      }
      setLoading(false);
    };
    load();
    return () => {
      isActive = false;
    };
  }, [slug, setTheme]);

  const handleSubmit = async (pickedGifts: SelectedGift[]): Promise<SubmitResult> => {
    return submitBySlug(slug, pickedGifts);
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <Card className="mx-auto w-full max-w-2xl">
          <div className="space-y-3">
            <div className="h-6 w-2/3 animate-pulse rounded-full bg-accent-soft-strong" />
            <div className="h-4 w-full animate-pulse rounded-full bg-accent-soft" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-accent-soft" />
          </div>
        </Card>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <Card className="mx-auto w-full max-w-2xl">
          <div className="flex items-start gap-3 text-sm text-accent-strong">
            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">We couldn’t load this gift page.</p>
              <p className="text-accent-muted">{error ?? 'Please check the link and try again.'}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <RecipientFlow config={config} onSubmit={handleSubmit} showCreateLink />;
}
