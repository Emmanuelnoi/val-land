import { useState } from 'react';
import type { FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faLink, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import Card from '../components/Card';
import Button from '../components/Button';
import { Link, useRouter } from '../router';

function normalizeRecipientPath(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const parsed = new URL(value);
      const path = `${parsed.pathname}${parsed.search}`;
      return path.startsWith('/v/') ? path : null;
    } catch {
      return null;
    }
  }

  if (value.startsWith('/v/')) return value;
  if (/^[a-z0-9_-]{4,}$/i.test(value)) return `/v/${value}`;
  return null;
}

export default function Home() {
  const { navigate } = useRouter();
  const [recipientLink, setRecipientLink] = useState('');
  const [linkError, setLinkError] = useState('');

  const handleOpenRecipient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const destination = normalizeRecipientPath(recipientLink);
    if (!destination) {
      setLinkError('Use a valid shared link or slug.');
      return;
    }
    setLinkError('');
    navigate(destination);
  };

  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-8">
      <Card className="mx-auto w-full max-w-3xl">
        <div className="space-y-5">
          <span className="valentine-chip">Val-land</span>
          <h1 className="text-balance text-3xl font-semibold leading-tight text-shadow-soft sm:text-5xl">
            <span className="text-rose-gradient">Create Beautiful Gift Pages In Minutes</span>
          </h1>
          <p className="max-w-2xl text-base text-ink-300/90">
            Build a personalized page, share one link, and let someone choose the gifts they love most.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/create"
              className="btn-primary inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-base font-medium transition-transform duration-200 hover:-translate-y-0.5 focus-ring touch-manipulation"
            >
              <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />
              Create Your Valentine
            </Link>
          </div>
        </div>
      </Card>

      <Card className="mx-auto w-full max-w-3xl bg-white/85">
        <div className="space-y-4">
          <h2 className="text-balance text-2xl font-semibold text-ink-500">Open A Shared Recipient Link</h2>
          <p className="text-sm text-ink-300/90">
            Paste a full link like <code>/v/abc123</code> or just the slug.
          </p>
          <form className="space-y-3" onSubmit={handleOpenRecipient}>
            <label className="flex flex-col gap-2 text-sm font-semibold text-ink-500">
              Shared Link Or Slug
              <input
                type="text"
                name="recipientPath"
                className="input-field"
                value={recipientLink}
                onChange={(event) => setRecipientLink(event.target.value)}
                autoComplete="off"
                placeholder="https://val-land.vercel.app/v/abc123…"
                aria-invalid={Boolean(linkError)}
                aria-describedby={linkError ? 'recipient-link-error' : undefined}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="secondary" size="md">
                <FontAwesomeIcon icon={faLink} aria-hidden="true" />
                Open Recipient Page
              </Button>
              <Link
                to="/create"
                className="link-soft inline-flex items-center gap-2 rounded-full px-2.5 py-1 focus-ring touch-manipulation"
              >
                Go To Creator Suite
                <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
              </Link>
            </div>
            <p id="recipient-link-error" className="text-xs text-accent" aria-live="polite">
              {linkError}
            </p>
          </form>
        </div>
      </Card>
    </div>
  );
}
