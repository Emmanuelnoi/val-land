import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faCirclePlus,
  faCopy,
  faGift,
  faLink,
  faPenNib,
  faTriangleExclamation,
  faTrash,
  faWandMagicSparkles
} from '@fortawesome/free-solid-svg-icons';
import Button from '../components/Button';
import Card from '../components/Card';
import { Link } from '../router';
import { createValentine } from '../lib/api';
import { DEFAULT_THEME, THEMES } from '../lib/themes';
import type { ThemeKey } from '../lib/themes';
import type { Gift, ValentineCreatePayload, ValentineCreateResult } from '../lib/types';
import { useTheme } from '../theme';

type GiftForm = Gift & { formId: string };

type FieldErrors = {
  toName?: string;
  message?: string;
  gifts?: string;
  creatorDiscordWebhookUrl?: string;
  giftErrors: Record<string, Partial<Record<'title' | 'description' | 'imageUrl' | 'linkUrl', string>>>;
};

const MAX_GIFTS = 12;
const MIN_GIFTS = 3;
const MAX_NAME = 60;
const MAX_MESSAGE = 180;
const MAX_TITLE = 60;
const MAX_DESCRIPTION = 140;

function createGiftForm(): GiftForm {
  const formId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `gift_${Math.random().toString(16).slice(2)}`;
  return {
    formId,
    id: formId,
    title: '',
    description: '',
    imageUrl: '',
    linkUrl: ''
  };
}

function isHttpUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

export default function Create() {
  const [toName, setToName] = useState('');
  const [message, setMessage] = useState('');
  const [gifts, setGifts] = useState<GiftForm[]>([createGiftForm(), createGiftForm(), createGiftForm()]);
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({ giftErrors: {} });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ValentineCreateResult | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<'share' | 'results' | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>(DEFAULT_THEME);
  const { setTheme } = useTheme();
  const createHeadline = useMemo(() => {
    switch (selectedTheme) {
      case 'birthday':
        return 'Create a Birthday Page';
      case 'sage':
        return 'Create a Gift Page';
      case 'valentine':
      default:
        return 'Create Your Valentine';
    }
  }, [selectedTheme]);
  const createSubtitle = useMemo(() => {
    switch (selectedTheme) {
      case 'birthday':
        return 'Build a celebratory page with gifts, a message, and optional Discord notifications.';
      case 'sage':
        return 'Build a calm, thoughtful page with gifts, a message, and optional Discord notifications.';
      case 'valentine':
      default:
        return 'Build a personalized page with gifts, a message, and optional Discord notifications.';
    }
  }, [selectedTheme]);

  const remainingMessage = useMemo(() => MAX_MESSAGE - message.length, [message.length]);

  useEffect(() => {
    setTheme(selectedTheme);
  }, [selectedTheme, setTheme]);
  const hasUnsavedChanges = useMemo(() => {
    if (result) return false;
    if (selectedTheme !== DEFAULT_THEME) return true;
    if (toName.trim() || message.trim() || discordWebhook.trim()) return true;
    return gifts.some(
      (gift) =>
        gift.title.trim() ||
        gift.description.trim() ||
        gift.imageUrl.trim() ||
        (gift.linkUrl?.trim() ?? '')
    );
  }, [toName, message, discordWebhook, gifts, result, selectedTheme]);

  useEffect(() => {
    if (!hasUnsavedChanges || typeof window === 'undefined') return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const validate = () => {
    const nextErrors: FieldErrors = { giftErrors: {} };
    if (!toName.trim()) nextErrors.toName = 'Please enter a name.';
    if (toName.trim().length > MAX_NAME) nextErrors.toName = `Keep it under ${MAX_NAME} characters.`;
    if (!message.trim()) nextErrors.message = 'Please add a short message.';
    if (message.trim().length > MAX_MESSAGE) nextErrors.message = `Keep it under ${MAX_MESSAGE} characters.`;
    if (gifts.length < MIN_GIFTS) nextErrors.gifts = `Add at least ${MIN_GIFTS} gifts.`;
    if (gifts.length > MAX_GIFTS) nextErrors.gifts = `Limit gifts to ${MAX_GIFTS}.`;

    if (discordWebhook.trim()) {
      const trimmed = discordWebhook.trim();
      const allowed =
        trimmed.startsWith('https://discord.com/api/webhooks/') ||
        trimmed.startsWith('https://discordapp.com/api/webhooks/');
      if (!allowed) {
        nextErrors.creatorDiscordWebhookUrl =
          'Webhook must start with https://discord.com/api/webhooks/.';
      }
    }

    gifts.forEach((gift) => {
      const giftErrors: FieldErrors['giftErrors'][string] = {};
      const trimmedImageUrl = gift.imageUrl.trim();
      const trimmedLinkUrl = gift.linkUrl?.trim() ?? '';
      if (!gift.title.trim()) giftErrors.title = 'Title is required.';
      if (gift.title.length > MAX_TITLE) giftErrors.title = `Max ${MAX_TITLE} characters.`;
      if (!gift.description.trim()) giftErrors.description = 'Description is required.';
      if (gift.description.length > MAX_DESCRIPTION)
        giftErrors.description = `Max ${MAX_DESCRIPTION} characters.`;
      if (!trimmedImageUrl) giftErrors.imageUrl = 'Image URL is required.';
      if (trimmedImageUrl && !isHttpUrl(trimmedImageUrl))
        giftErrors.imageUrl = 'Use a valid http(s) URL.';
      if (trimmedLinkUrl && !isHttpUrl(trimmedLinkUrl))
        giftErrors.linkUrl = 'Use a valid http(s) URL.';
      if (Object.keys(giftErrors).length > 0) {
        nextErrors.giftErrors[gift.formId] = giftErrors;
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 1 && Object.keys(nextErrors.giftErrors).length === 0;
  };

  const updateGift = (formId: string, patch: Partial<GiftForm>) => {
    setGifts((prev) => prev.map((gift) => (gift.formId === formId ? { ...gift, ...patch } : gift)));
  };

  const handleAddGift = () => {
    if (gifts.length >= MAX_GIFTS) return;
    setGifts((prev) => [...prev, createGiftForm()]);
  };

  const handleRemoveGift = (formId: string) => {
    if (gifts.length <= MIN_GIFTS) return;
    setGifts((prev) => prev.filter((gift) => gift.formId !== formId));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          const invalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
          invalid?.focus();
        });
      }
      return;
    }
    setIsSubmitting(true);

    const payload: ValentineCreatePayload = {
      toName: toName.trim(),
      message: message.trim(),
      gifts: gifts.map((gift) => ({
        id: gift.id,
        title: gift.title.trim(),
        description: gift.description.trim(),
        imageUrl: gift.imageUrl.trim(),
        linkUrl: gift.linkUrl?.trim() || undefined
      })),
      creatorDiscordWebhookUrl: discordWebhook.trim() || undefined,
      theme: selectedTheme
    };

    const response = await createValentine(payload);
    if (response.ok) {
      setResult(response.result);
    } else {
      setErrors((prev) => ({ ...prev, gifts: response.error }));
    }
    setIsSubmitting(false);
  };

  const handleCopy = async (value: string, label: string, key: 'share' | 'results') => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setCopyMessage(`${label} copied.`);
        setCopiedKey(key);
      } else {
        const temp = document.createElement('textarea');
        temp.value = value;
        temp.setAttribute('readonly', '');
        temp.style.position = 'absolute';
        temp.style.left = '-9999px';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        setCopyMessage(`${label} copied.`);
        setCopiedKey(key);
      }
    } catch (error) {
      setCopyMessage('Copy failed.');
    } finally {
      window.setTimeout(() => {
        setCopyMessage(null);
        setCopiedKey(null);
      }, 2000);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="valentine-chip">Creator Suite</span>
          <h1 className="mt-4 text-balance text-3xl font-semibold text-shadow-soft sm:text-4xl">
            <span className="text-rose-gradient">{createHeadline}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-300/90">{createSubtitle}</p>
        </div>
        <Link
          to="/"
          className="btn-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold shadow-soft focus-ring transition-transform duration-200 hover:-translate-y-0.5 touch-manipulation"
          onClick={(event) => {
            if (!hasUnsavedChanges) return;
            if (typeof window !== 'undefined') {
              const shouldLeave = window.confirm('You have unsaved changes. Leave this page?');
              if (!shouldLeave) {
                event.preventDefault();
              }
            }
          }}
        >
          <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
          Back to Home
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-400">
                <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />
                Theme
              </div>
              <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
                {THEMES.map((theme) => {
                  const isActive = theme.key === selectedTheme;
                  return (
                    <button
                      key={theme.key}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setSelectedTheme(theme.key)}
                      className={[
                        'rounded-2xl border px-4 py-3 text-left transition-shadow focus-ring',
                        isActive
                          ? 'border-accent-strong bg-accent-soft shadow-soft'
                          : 'border-white/70 bg-white/70 hover:shadow-soft'
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-ink-500">{theme.label}</span>
                        {isActive ? (
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-ink-300">{theme.description}</p>
                      <div className="mt-3 flex items-center gap-2">
                        {theme.preview.map((color) => (
                          <span
                            key={`${theme.key}-${color}`}
                            className="h-3 w-3 rounded-full border border-white/80"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-400">
                <FontAwesomeIcon icon={faPenNib} aria-hidden="true" />
                Personal Details
              </div>
              <label className="flex flex-col gap-2 text-sm font-semibold text-ink-500">
                To (name)
                <input
                  className="input-field"
                  value={toName}
                  onChange={(event) => setToName(event.target.value)}
                  maxLength={MAX_NAME}
                  name="toName"
                  autoComplete="off"
                  placeholder="e.g. Bri…"
                  aria-invalid={Boolean(errors.toName)}
                  aria-describedby={errors.toName ? 'toName-error' : undefined}
                />
                <div className="flex items-center justify-between text-xs text-ink-300">
                  <span id="toName-error" aria-live="polite">
                    {errors.toName}
                  </span>
                  <span>{toName.length}/{MAX_NAME}</span>
                </div>
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-ink-500">
                Message
                <textarea
                  className="input-field min-h-[120px] resize-y"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={MAX_MESSAGE}
                  name="message"
                  autoComplete="off"
                  placeholder="Say something sweet…"
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? 'message-error' : undefined}
                />
                <div className="flex items-center justify-between text-xs text-ink-300">
                  <span id="message-error" aria-live="polite">
                    {errors.message}
                  </span>
                  <span>{remainingMessage} left</span>
                </div>
              </label>
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-400">
                <FontAwesomeIcon icon={faGift} aria-hidden="true" />
                Gift Builder
              </div>
              {errors.gifts ? (
                <div className="flex items-start gap-2 text-sm text-accent-strong" aria-live="polite">
                  <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" aria-hidden="true" />
                  <span>{errors.gifts}</span>
                </div>
              ) : null}

              <div className="space-y-4">
                {gifts.map((gift, index) => {
                  const giftErrors = errors.giftErrors[gift.formId] || {};
                  const previewOk = gift.imageUrl.trim() && isHttpUrl(gift.imageUrl.trim());
                  return (
                    <div key={gift.formId} className="rounded-2xl border border-accent-muted bg-white/70 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-ink-500">Gift {index + 1}</h3>
                        <button
                          type="button"
                          className="text-xs font-semibold text-accent hover-text-accent-strong focus-ring touch-manipulation"
                          onClick={() => handleRemoveGift(gift.formId)}
                          disabled={gifts.length <= MIN_GIFTS}
                        >
                          <FontAwesomeIcon icon={faTrash} aria-hidden="true" /> Remove
                        </button>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
                        <div className="space-y-3">
                          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">
                            Title
                            <input
                              className="input-field"
                              value={gift.title}
                              onChange={(event) => updateGift(gift.formId, { title: event.target.value })}
                              maxLength={MAX_TITLE}
                              name={`gift-${index}-title`}
                              autoComplete="off"
                              aria-invalid={Boolean(giftErrors.title)}
                              aria-describedby={giftErrors.title ? `${gift.formId}-title-error` : undefined}
                            />
                            <span id={`${gift.formId}-title-error`} className="text-xs text-accent" aria-live="polite">
                              {giftErrors.title}
                            </span>
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">
                            Description
                            <textarea
                              className="input-field min-h-[84px] resize-y"
                              value={gift.description}
                              onChange={(event) => updateGift(gift.formId, { description: event.target.value })}
                              maxLength={MAX_DESCRIPTION}
                              name={`gift-${index}-description`}
                              autoComplete="off"
                              aria-invalid={Boolean(giftErrors.description)}
                              aria-describedby={
                                giftErrors.description ? `${gift.formId}-description-error` : undefined
                              }
                            />
                            <span id={`${gift.formId}-description-error`} className="text-xs text-accent" aria-live="polite">
                              {giftErrors.description}
                            </span>
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">
                            Image URL
                            <input
                              className="input-field"
                              type="url"
                              inputMode="url"
                              value={gift.imageUrl}
                              onChange={(event) => updateGift(gift.formId, { imageUrl: event.target.value })}
                              name={`gift-${index}-imageUrl`}
                              autoComplete="off"
                              aria-invalid={Boolean(giftErrors.imageUrl)}
                              aria-describedby={giftErrors.imageUrl ? `${gift.formId}-imageUrl-error` : undefined}
                            />
                            <span id={`${gift.formId}-imageUrl-error`} className="text-xs text-accent" aria-live="polite">
                              {giftErrors.imageUrl}
                            </span>
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">
                            Link URL (optional)
                            <input
                              className="input-field"
                              type="url"
                              inputMode="url"
                              value={gift.linkUrl ?? ''}
                              onChange={(event) => updateGift(gift.formId, { linkUrl: event.target.value })}
                              name={`gift-${index}-linkUrl`}
                              autoComplete="off"
                              aria-invalid={Boolean(giftErrors.linkUrl)}
                              aria-describedby={giftErrors.linkUrl ? `${gift.formId}-linkUrl-error` : undefined}
                            />
                            <span id={`${gift.formId}-linkUrl-error`} className="text-xs text-accent" aria-live="polite">
                              {giftErrors.linkUrl}
                            </span>
                          </label>
                        </div>
                        <div className="flex items-center justify-center rounded-2xl border border-accent bg-accent-soft-faint p-2 text-xs text-accent-muted">
                          {previewOk ? (
                            <img
                              src={gift.imageUrl.trim()}
                              alt={`${gift.title || 'Gift'} preview`}
                              width={140}
                              height={128}
                              className="h-32 w-full rounded-xl object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="text-center">
                              <FontAwesomeIcon icon={faLink} aria-hidden="true" />
                              <p className="mt-2">Add a valid image URL</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="md"
                className="w-full justify-center"
                onClick={handleAddGift}
                disabled={gifts.length >= MAX_GIFTS}
              >
                <FontAwesomeIcon icon={faCirclePlus} aria-hidden="true" />
                Add Another Gift
              </Button>
            </div>
          </Card>

          <Card>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-400">
                <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />
                Notifications (optional)
              </div>
              <label className="flex flex-col gap-2 text-sm font-semibold text-ink-500">
                Notify me on Discord
                <input
                  className="input-field"
                  value={discordWebhook}
                  onChange={(event) => setDiscordWebhook(event.target.value)}
                  type="url"
                  inputMode="url"
                  name="creatorDiscordWebhookUrl"
                  autoComplete="off"
                  placeholder="https://discord.com/api/webhooks/…"
                  aria-invalid={Boolean(errors.creatorDiscordWebhookUrl)}
                  aria-describedby={errors.creatorDiscordWebhookUrl ? 'webhook-error' : undefined}
                />
                <span id="webhook-error" className="text-xs text-accent" aria-live="polite">
                  {errors.creatorDiscordWebhookUrl}
                </span>
              </label>
              <p className="text-xs text-ink-300">
                Create a webhook in your Discord server settings → Integrations → Webhooks.
              </p>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
              <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />
              {isSubmitting ? 'Creating…' : 'Generate Share Link'}
            </Button>
            {copyMessage ? (
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-300" aria-live="polite">
                {copyMessage}
              </span>
            ) : null}
          </div>
        </form>

        <div className="space-y-4">
          <Card className="bg-white/80">
            <div className="space-y-2 text-sm text-ink-400">
              <p className="font-semibold text-ink-500">What happens next?</p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Share your custom link with someone special.</li>
                <li>They pick three gifts.</li>
                <li>You’ll get notified (if Discord is set).</li>
              </ol>
            </div>
          </Card>

          {result ? (
            <Card className="bg-white/90">
              <div className="space-y-3">
                <div className="text-sm font-semibold text-ink-500">Your links are ready</div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">Share link</p>
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-accent bg-accent-soft-muted px-3 py-2 text-sm text-ink-500">
                    <span className="break-all">{result.shareUrl}</span>
                    <button
                      type="button"
                      className={[
                        'text-xs font-semibold text-accent transition-colors focus-ring touch-manipulation rounded-full px-2.5 py-1',
                        copiedKey === 'share'
                          ? 'bg-accent-soft-strong text-accent-strong'
                          : 'hover-accent-soft hover-text-accent-strong'
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleCopy(result.shareUrl, 'Share link', 'share')}
                    >
                      <FontAwesomeIcon icon={faCopy} aria-hidden="true" /> {copiedKey === 'share' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">Results link</p>
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-accent bg-accent-soft-muted px-3 py-2 text-sm text-ink-500">
                    <span className="break-all">{result.resultsUrl}</span>
                    <button
                      type="button"
                      className={[
                        'text-xs font-semibold text-accent transition-colors focus-ring touch-manipulation rounded-full px-2.5 py-1',
                        copiedKey === 'results'
                          ? 'bg-accent-soft-strong text-accent-strong'
                          : 'hover-accent-soft hover-text-accent-strong'
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleCopy(result.resultsUrl, 'Results link', 'results')}
                    >
                      <FontAwesomeIcon icon={faCopy} aria-hidden="true" />{' '}
                      {copiedKey === 'results' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-accent">
                    Save this link — it’s only shown once.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="bg-white/70">
              <div className="space-y-2 text-sm text-ink-400">
                <p className="font-semibold text-ink-500">Share and results links</p>
                <p>Generate your Valentine to reveal share + results links.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
