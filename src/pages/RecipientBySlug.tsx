import { useEffect, useState } from 'react';
import RecipientFlow from '../components/RecipientFlow';
import { fetchConfig, submitBySlug, type SubmitResult } from '../lib/api';
import type { SelectedGift, ValentinePublicConfig } from '../lib/types';
import Card from '../components/Card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

type RecipientBySlugProps = {
  slug: string;
};

export default function RecipientBySlug({ slug }: RecipientBySlugProps) {
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
      } else {
        setConfig(result.config);
      }
      setLoading(false);
    };
    load();
    return () => {
      isActive = false;
    };
  }, [slug]);

  const handleSubmit = async (pickedGifts: SelectedGift[]): Promise<SubmitResult> => {
    return submitBySlug(slug, pickedGifts);
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <Card className="mx-auto w-full max-w-2xl">
          <div className="space-y-3">
            <div className="h-6 w-2/3 animate-pulse rounded-full bg-rose-100" />
            <div className="h-4 w-full animate-pulse rounded-full bg-rose-50" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-rose-50" />
          </div>
        </Card>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <Card className="mx-auto w-full max-w-2xl">
          <div className="flex items-start gap-3 text-sm text-rose-700">
            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">We couldn’t load this Valentine.</p>
              <p className="text-rose-700/80">{error ?? 'Please check the link and try again.'}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <RecipientFlow config={config} onSubmit={handleSubmit} showCreateLink />;
}
