import { useState } from 'react';
import type { FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import Card from '../components/Card';
import { Link } from '../router';
import { useRouter } from '../router';

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

  const handleOpenSharedLink = (event: FormEvent<HTMLFormElement>) => {
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
          <span className="valentine-chip">Gift-land</span>
          <h1 className="text-balance text-3xl font-semibold leading-tight text-shadow-soft sm:text-5xl">
            <span className="text-rose-gradient">Create Beautiful Gift Pages In Minutes</span>
          </h1>
          <p className="max-w-2xl text-base text-ink-300/90">
            Build a personalized page, share one link, and let someone choose the gifts they love most.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/create"
              className="btn-primary inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-base font-medium transition-transform duration-200 hover:-translate-y-0.5 focus-ring touch-manipulation"
            >
              <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />
              Create Your Gift Page
            </Link>
          </div>
          <form className="space-y-2" onSubmit={handleOpenSharedLink}>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">
              Open Shared Link
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  name="recipientPath"
                  className="input-field min-w-[220px] flex-1"
                  value={recipientLink}
                  onChange={(event) => setRecipientLink(event.target.value)}
                  autoComplete="off"
                  placeholder="/v/abc123…"
                  aria-invalid={Boolean(linkError)}
                  aria-describedby={linkError ? 'recipient-link-error' : undefined}
                />
                <button
                  type="submit"
                  className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] focus-ring touch-manipulation"
                >
                  <FontAwesomeIcon icon={faLink} aria-hidden="true" />
                  Open
                </button>
              </div>
            </label>
            <p id="recipient-link-error" className="text-xs text-accent" aria-live="polite">
              {linkError}
            </p>
          </form>
        </div>
      </Card>
    </div>
  );
}
