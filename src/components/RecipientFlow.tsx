import { useEffect, useMemo, useReducer, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faArrowUpRightFromSquare,
  faGift,
  faHeart,
  faRotateLeft,
  faTriangleExclamation,
  faWandMagicSparkles,
  faXmark
} from '@fortawesome/free-solid-svg-icons';
import Button from './Button';
import Card from './Card';
import GiftCard from './GiftCard';
import SelectedSummary from './SelectedSummary';
import { Link } from '../router';
import type { Gift, SelectedGift } from '../lib/types';
import type { SubmitResult } from '../lib/api';
import { incrementStat } from '../lib/analytics';
import { useTheme } from '../theme';
import type { ThemeKey } from '../lib/themes';

type RecipientConfig = {
  toName: string;
  message: string;
  gifts: Gift[];
};

type RecipientFlowProps = {
  config: RecipientConfig;
  onSubmit: (pickedGifts: SelectedGift[]) => Promise<SubmitResult>;
  showCreateLink?: boolean;
};

type AppState =
  | { view: 'ASK' }
  | { view: 'GIFTS'; selected: SelectedGift[] }
  | { view: 'THANKS'; selected: SelectedGift[]; submitError?: string };

type Action =
  | { type: 'CONFIRM_YES' }
  | { type: 'SELECT_GIFT'; gift: SelectedGift }
  | { type: 'REMOVE_GIFT'; id: string }
  | { type: 'SUBMIT_RESULT'; ok: boolean; error?: string }
  | { type: 'RESET' };

const initialState: AppState = { view: 'ASK' };

type ConfettiPiece = {
  id: string;
  x: number;
  size: number;
  delay: number;
  duration: number;
  rotate: number;
  color: string;
};

type ConfettiBurst = {
  id: string;
  pieces: ConfettiPiece[];
};

const CONFETTI_PIECES = 54;
const REQUIRED_GIFTS = 3;

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CONFIRM_YES':
      if (state.view !== 'ASK') return state;
      return { view: 'GIFTS', selected: [] };
    case 'SELECT_GIFT':
      if (state.view !== 'GIFTS') return state;
      if (state.selected.some((gift) => gift.id === action.gift.id)) return state;
      if (state.selected.length >= REQUIRED_GIFTS) return state;
      return { ...state, selected: [...state.selected, action.gift] };
    case 'REMOVE_GIFT':
      if (state.view !== 'GIFTS') return state;
      return { ...state, selected: state.selected.filter((gift) => gift.id !== action.id) };
    case 'SUBMIT_RESULT':
      if (state.view !== 'GIFTS') return state;
      return {
        view: 'THANKS',
        selected: state.selected,
        submitError: action.ok ? undefined : action.error ?? 'Submission failed'
      };
    case 'RESET':
      return { view: 'ASK' };
    default:
      return state;
  }
}

function createConfettiBurst(colors: string[]): ConfettiBurst {
  const burstId = `burst_${Math.random().toString(16).slice(2)}`;
  const pieces = Array.from({ length: CONFETTI_PIECES }).map((_, index) => ({
    id: `${burstId}_${index}`,
    x: Math.round(10 + Math.random() * 80),
    size: Math.round(7 + Math.random() * 8),
    delay: Math.round(Math.random() * 300),
    duration: Math.round(2000 + Math.random() * 1400),
    rotate: Math.round(Math.random() * 360),
    color: colors[index % colors.length]
  }));

  return { id: burstId, pieces };
}

function toSelectedGift(gift: Gift): SelectedGift {
  return {
    id: gift.id,
    title: gift.title,
    linkUrl: gift.linkUrl,
    imageUrl: gift.imageUrl
  };
}

function getThemeCopy(themeKey: ThemeKey, toName: string) {
  const name = toName?.trim();
  switch (themeKey) {
    case 'birthday':
      return {
        collectionLabel: 'Birthday Selection',
        headline: name ? `${name}, Ready For Your Birthday Treats?` : 'Ready For Your Birthday Treats?',
        fallbackMessage: 'A little celebration, curated just for you.',
        giftsTitle: 'Pick Three Treats',
        giftsSubtitle: 'Three celebratory picks, one joyful moment.',
        thanksTitle: 'Birthday Picks Locked In',
        thanksSubtitle: 'Your treats are set. Enjoy the celebration.'
      };
    case 'sage':
      return {
        collectionLabel: 'Gift Selection',
        headline: name ? `${name}, Want A Little Surprise?` : 'Want A Little Surprise?',
        fallbackMessage: 'A calm, thoughtful moment — just for you.',
        giftsTitle: 'Pick Three',
        giftsSubtitle: 'Three thoughtful picks, one calm yes.',
        thanksTitle: 'Selections Confirmed',
        thanksSubtitle: 'Your picks are set. Here is the recap.'
      };
    case 'valentine':
    default:
      return {
        collectionLabel: 'Valentine Collection',
        headline: name ? `${name}, Will You Be My Valentine?` : 'Will You Be My Valentine?',
        fallbackMessage: 'A small question with a soft landing.',
        giftsTitle: 'Pick Three',
        giftsSubtitle: 'Three elegant treats, one effortless choice.',
        thanksTitle: 'You Chose Beautifully',
        thanksSubtitle: 'Your picks are set. Here is the recap.'
      };
  }
}

export default function RecipientFlow({ config, onSubmit, showCreateLink = true }: RecipientFlowProps) {
  const { activeTheme } = useTheme();
  const confettiColors = useMemo(() => activeTheme.confetti, [activeTheme.confetti]);
  const themeCopy = useMemo(
    () => getThemeCopy(activeTheme.key, config.toName),
    [activeTheme.key, config.toName]
  );
  const [state, dispatch] = useReducer(reducer, initialState);
  const [visibleGifts, setVisibleGifts] = useState<Gift[]>(config.gifts);
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noIsYes, setNoIsYes] = useState(false);
  const [noWiggle, setNoWiggle] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [confettiBursts, setConfettiBursts] = useState<ConfettiBurst[]>([]);

  useEffect(() => {
    setVisibleGifts(config.gifts);
    setLeavingIds(new Set());
    setIsSubmitting(false);
    setNoIsYes(false);
    setNoWiggle(false);
    dispatch({ type: 'RESET' });
  }, [config]);

  useEffect(() => {
    if (state.view === 'ASK') {
      setVisibleGifts(config.gifts);
      setLeavingIds(new Set());
      setIsSubmitting(false);
      setNoIsYes(false);
      setNoWiggle(false);
    }
  }, [state.view, config.gifts]);

  const selectedCount = state.view === 'GIFTS' ? state.selected.length : 0;
  const giftOrder = useMemo(() => {
    const map = new Map<string, number>();
    config.gifts.forEach((gift, index) => map.set(gift.id, index));
    return map;
  }, [config.gifts]);
  const selectedGifts = useMemo(() => {
    if (state.view === 'GIFTS' || state.view === 'THANKS') return state.selected;
    return [];
  }, [state]);

  const triggerConfetti = () => {
    const burst = createConfettiBurst(confettiColors);
    setConfettiBursts((prev) => [...prev, burst]);
    window.setTimeout(() => {
      const followUp = createConfettiBurst(confettiColors);
      setConfettiBursts((prev) => [...prev, followUp]);
      window.setTimeout(() => {
        setConfettiBursts((prev) =>
          prev.filter((item) => item.id !== burst.id && item.id !== followUp.id)
        );
      }, 2400);
    }, 550);
  };

  const handleConfirmYes = () => {
    incrementStat('yesClicks');
    triggerConfetti();
    dispatch({ type: 'CONFIRM_YES' });
  };

  const handleNoActivate = () => {
    setNoIsYes(true);
    setNoWiggle(true);
    window.setTimeout(() => setNoWiggle(false), 200);
    incrementStat('noClicks');
    triggerConfetti();
    dispatch({ type: 'CONFIRM_YES' });
  };

  const handleNoKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNoActivate();
    }
  };

  const handleSelectGift = (gift: Gift) => {
    if (state.view !== 'GIFTS' || isSubmitting) return;
    if (state.selected.length >= REQUIRED_GIFTS) return;

    incrementStat('giftSelections');
    if (state.selected.length === REQUIRED_GIFTS - 1) {
      triggerConfetti();
    }

    setLeavingIds((prev) => new Set(prev).add(gift.id));
    window.setTimeout(() => {
      setVisibleGifts((prev) => prev.filter((item) => item.id !== gift.id));
      setLeavingIds((prev) => {
        const next = new Set(prev);
        next.delete(gift.id);
        return next;
      });
    }, 200);

    const nextGift = toSelectedGift(gift);
    dispatch({ type: 'SELECT_GIFT', gift: nextGift });
  };

  const handleRemoveGift = (giftId: string) => {
    if (state.view !== 'GIFTS' || isSubmitting) return;
    dispatch({ type: 'REMOVE_GIFT', id: giftId });
    const gift = config.gifts.find((item) => item.id === giftId);
    if (!gift) return;
    setVisibleGifts((prev) => {
      if (prev.some((item) => item.id === giftId)) return prev;
      const next = [...prev, gift];
      return next.sort(
        (a, b) => (giftOrder.get(a.id) ?? 0) - (giftOrder.get(b.id) ?? 0)
      );
    });
  };

  const handleConfirmSelections = async () => {
    if (state.view !== 'GIFTS') return;
    if (state.selected.length !== REQUIRED_GIFTS) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    const result = await onSubmit(state.selected);
    if (result.ok) {
      incrementStat('completions');
    }
    dispatch({ type: 'SUBMIT_RESULT', ok: result.ok, error: result.ok ? undefined : result.error });
    setIsSubmitting(false);
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const title = config.toName ? `${config.toName}'s Valentine` : 'Valentine';
    const text = config.toName
      ? `A little something for ${config.toName}.`
      : 'A little something for you.';

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        incrementStat('shares');
        setShareMessage('Shared.');
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        incrementStat('shares');
        setShareMessage('Link copied.');
        return;
      }

      const temp = document.createElement('textarea');
      temp.value = url;
      temp.setAttribute('readonly', '');
      temp.style.position = 'absolute';
      temp.style.left = '-9999px';
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      incrementStat('shares');
      setShareMessage('Link copied.');
    } catch (error) {
      setShareMessage('Share failed.');
    } finally {
      window.setTimeout(() => setShareMessage(null), 2500);
    }
  };

  return (
    <>
      <div className="confetti-layer" aria-hidden="true">
        {confettiBursts.flatMap((burst) =>
          burst.pieces.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece"
              style={
                {
                  '--x': `${piece.x}%`,
                  '--size': `${piece.size}px`,
                  '--delay': `${piece.delay}ms`,
                  '--duration': `${piece.duration}ms`,
                  '--rot': `${piece.rotate}deg`,
                  '--color': piece.color
                } as CSSProperties
              }
            />
          ))
        )}
      </div>

      {state.view === 'ASK' ? (
        <div className="flex flex-1 flex-col justify-center gap-10">
          <div className="valentine-panel mx-auto w-full max-w-3xl p-8 sm:p-12">
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="valentine-chip">{themeCopy.collectionLabel}</span>
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-300">
                    {config.toName ? `For ${config.toName}` : 'For You'}
                  </span>
                </div>
                {showCreateLink ? (
                  <Link
                    to="/create"
                    className="btn-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold shadow-soft focus-ring transition-transform duration-200 hover:-translate-y-0.5 touch-manipulation"
                  >
                    <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />
                    Create your Valentine
                  </Link>
                ) : null}
              </div>
              <div className="space-y-4">
                <h1 className="text-balance text-3xl font-semibold leading-tight text-shadow-soft sm:text-5xl">
                  <span className="break-words text-rose-gradient">
                    {themeCopy.headline}
                  </span>
                </h1>
                <p className="max-w-2xl text-base text-ink-300/90">
                  {config.message || themeCopy.fallbackMessage}
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button variant="primary" size="lg" onClick={handleConfirmYes}>
                  <FontAwesomeIcon icon={faHeart} aria-hidden="true" />
                  Yes
                </Button>
                <Button
                  variant={noIsYes ? 'primary' : 'secondary'}
                  size="lg"
                  className={noWiggle ? 'animate-wiggle' : ''}
                  onMouseEnter={() => setNoIsYes(true)}
                  onFocus={() => setNoIsYes(true)}
                  onMouseLeave={() => setNoIsYes(false)}
                  onBlur={() => setNoIsYes(false)}
                  onClick={handleNoActivate}
                  onKeyDown={handleNoKeyDown}
                  aria-label={noIsYes ? 'Yes' : 'No'}
                >
                  <FontAwesomeIcon icon={noIsYes ? faHeart : faXmark} aria-hidden="true" />
                  {noIsYes ? 'Yes' : 'No'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {state.view === 'GIFTS' ? (
        <div className="flex flex-1 flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="valentine-chip">Curated Mini Luxuries</span>
                <h1 className="mt-4 text-balance text-3xl font-semibold text-shadow-soft sm:text-4xl">
                  <span className="text-rose-gradient">{themeCopy.giftsTitle}</span>
                </h1>
                <p className="mt-2 text-base text-ink-300/90">
                  {themeCopy.giftsSubtitle}
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-accent-strong shadow-soft">
                <span className="rounded-full bg-accent-soft-strong px-2.5 py-1 text-xs font-semibold tabular-nums text-accent">
                  {selectedCount}/{REQUIRED_GIFTS}
                </span>
                {selectedCount === 1
                  ? 'Two More'
                  : selectedCount === 2
                    ? 'One More'
                    : 'Make Your Selection'}
              </div>
            </div>
            {isSubmitting ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-accent" aria-live="polite">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                Sending…
              </div>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <h2 className="sr-only">Gift Options</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {visibleGifts.map((gift) => (
                  <GiftCard
                    key={gift.id}
                    gift={gift}
                    onSelect={handleSelectGift}
                    disabled={isSubmitting || selectedCount >= REQUIRED_GIFTS}
                    isLeaving={leavingIds.has(gift.id)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <SelectedSummary
                selected={selectedGifts}
                total={REQUIRED_GIFTS}
                onRemove={handleRemoveGift}
              />
              <Card>
                <div className="space-y-3">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full justify-center"
                    onClick={handleConfirmSelections}
                    disabled={isSubmitting || selectedCount !== REQUIRED_GIFTS}
                  >
                    <FontAwesomeIcon icon={faGift} aria-hidden="true" />
                    {isSubmitting ? 'Sending…' : 'Confirm Selections'}
                  </Button>
                  <p className="text-sm text-ink-300">
                    Confirm all three picks to send the note.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {state.view === 'THANKS' ? (
        <div className="flex flex-1 flex-col justify-center gap-8">
          <div className="valentine-panel mx-auto w-full max-w-3xl p-8 sm:p-12">
            <div className="space-y-6">
              <div className="space-y-3">
                <span className="valentine-chip">Sealed & Sent</span>
                <h1 className="text-balance text-3xl font-semibold text-shadow-soft sm:text-4xl">
                  <span className="text-rose-gradient">{themeCopy.thanksTitle}</span>
                </h1>
                <p className="text-base text-ink-300/90">{themeCopy.thanksSubtitle}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-300">
                  {config.toName ? `Reserved for ${config.toName}` : 'Reserved for You'}
                </p>
              </div>

              {state.submitError ? (
                <div
                  className="flex items-start gap-3 rounded-2xl border border-accent-strong bg-accent-soft px-4 py-3 text-sm text-accent-strong"
                  role="alert"
                >
                  <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Couldn’t send the notification.</p>
                    <p className="text-accent-muted">{state.submitError}</p>
                  </div>
                </div>
              ) : null}

              <h2 className="sr-only">Gift Recap</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {state.selected.map((gift) => (
                  <Card key={gift.id} className="bg-white/85">
                    <div className="flex min-w-0 items-start gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft-strong text-accent">
                        <FontAwesomeIcon icon={faGift} size="lg" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-semibold text-ink-500">{gift.title}</h3>
                        {gift.linkUrl ? (
                          <a
                            href={gift.linkUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="link-soft mt-2 inline-flex items-center gap-2 focus-ring touch-manipulation"
                          >
                            View Details
                            <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                          </a>
                        ) : (
                          <p className="mt-2 text-sm text-ink-300">No link provided</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex flex-wrap gap-4">
                <Button variant="primary" size="lg" onClick={() => dispatch({ type: 'RESET' })}>
                  <FontAwesomeIcon icon={faRotateLeft} aria-hidden="true" />
                  Start Over
                </Button>
                <Button variant="ghost" size="md" onClick={handleShare}>
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                  Share
                </Button>
              </div>
              {shareMessage ? (
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-300" aria-live="polite">
                  {shareMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
