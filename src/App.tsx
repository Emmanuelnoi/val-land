import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHeart,
  faXmark,
  faArrowRight,
  faArrowUpRightFromSquare,
  faGift,
  faTriangleExclamation,
  faRotateLeft
} from '@fortawesome/free-solid-svg-icons';
import PageShell from './components/PageShell';
import Button from './components/Button';
import GiftCard from './components/GiftCard';
import SelectedSummary from './components/SelectedSummary';
import Card from './components/Card';
import { gifts as giftData, type Gift } from './data/gifts';
import { recipientName } from './data/recipient';
import { submitSelection } from './lib/api';
import type { SelectedGift, SubmissionPayload } from './lib/types';
import {
  drainSubmissionQueue,
  enqueueFailedSubmission,
  getNextAttemptDelayMs,
  readSubmissionQueue
} from './lib/submission-queue';
import { incrementStat } from './lib/analytics';

type AppState =
  | { view: 'ASK'; name: string }
  | { view: 'GIFTS'; name: string; selected: SelectedGift[] }
  | {
      view: 'THANKS';
      name: string;
      selected: SelectedGift[];
      submitError?: string;
    };

type Action =
  | { type: 'CONFIRM_YES' }
  | { type: 'SELECT_GIFT'; gift: SelectedGift }
  | { type: 'SUBMIT_RESULT'; ok: boolean; error?: string }
  | { type: 'RESET' };

const initialState: AppState = { view: 'ASK', name: recipientName };

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

const CONFETTI_COLORS = ['#FF90B3', '#F05D88', '#FFD4B2', '#FFE7F0', '#D94873', '#FFB3C7'];
const CONFETTI_PIECES = 54;

function createConfettiBurst(): ConfettiBurst {
  const burstId = `burst_${Math.random().toString(16).slice(2)}`;
  const pieces = Array.from({ length: CONFETTI_PIECES }).map((_, index) => ({
    id: `${burstId}_${index}`,
    x: Math.round(10 + Math.random() * 80),
    size: Math.round(7 + Math.random() * 8),
    delay: Math.round(Math.random() * 300),
    duration: Math.round(2000 + Math.random() * 1400),
    rotate: Math.round(Math.random() * 360),
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length]
  }));

  return { id: burstId, pieces };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CONFIRM_YES':
      if (state.view !== 'ASK') return state;
      return { view: 'GIFTS', name: state.name.trim(), selected: [] };
    case 'SELECT_GIFT':
      if (state.view !== 'GIFTS') return state;
      if (state.selected.some((gift) => gift.id === action.gift.id)) return state;
      if (state.selected.length >= 2) return state;
      return { ...state, selected: [...state.selected, action.gift] };
    case 'SUBMIT_RESULT':
      if (state.view !== 'GIFTS') return state;
      return {
        view: 'THANKS',
        name: state.name,
        selected: state.selected,
        submitError: action.ok ? undefined : action.error ?? 'Submission failed'
      };
    case 'RESET':
      return { view: 'ASK', name: recipientName };
    default:
      return state;
  }
}

function getBrowserStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage ?? null;
}

function toSelectedGift(gift: Gift): SelectedGift {
  return {
    id: gift.id,
    title: gift.title,
    linkUrl: gift.linkUrl
  };
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [visibleGifts, setVisibleGifts] = useState<Gift[]>(giftData);
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noIsYes, setNoIsYes] = useState(false);
  const [noWiggle, setNoWiggle] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [confettiBursts, setConfettiBursts] = useState<ConfettiBurst[]>([]);
  const drainTimerRef = useRef<number | null>(null);
  const drainingRef = useRef(false);
  const shareTimerRef = useRef<number | null>(null);

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

  const triggerConfetti = () => {
    const burst = createConfettiBurst();
    setConfettiBursts((prev) => [...prev, burst]);
    window.setTimeout(() => {
      const followUp = createConfettiBurst();
      setConfettiBursts((prev) => [...prev, followUp]);
      window.setTimeout(() => {
        setConfettiBursts((prev) =>
          prev.filter((item) => item.id !== burst.id && item.id !== followUp.id)
        );
      }, 2400);
    }, 550);
  };

  const setShareStatus = (message: string) => {
    setShareMessage(message);
    if (shareTimerRef.current) {
      window.clearTimeout(shareTimerRef.current);
    }
    shareTimerRef.current = window.setTimeout(() => {
      setShareMessage(null);
    }, 2500);
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const title = state.name.trim()
      ? `${state.name.trim()}'s Valentine`
      : 'Valentine';
    const text = state.name.trim()
      ? `A little something for ${state.name.trim()}.`
      : 'A little something for you.';

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        incrementStat('shares');
        setShareStatus('Shared.');
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        incrementStat('shares');
        setShareStatus('Link copied.');
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
      setShareStatus('Link copied.');
    } catch (error) {
      setShareStatus('Share failed.');
    }
  };

  useEffect(() => {
    void runDrain();
    return () => {
      if (drainTimerRef.current) {
        window.clearTimeout(drainTimerRef.current);
      }
      if (shareTimerRef.current) {
        window.clearTimeout(shareTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state.view === 'ASK') {
      setVisibleGifts(giftData);
      setLeavingIds(new Set());
      setIsSubmitting(false);
      setNoIsYes(false);
      setNoWiggle(false);
    }
  }, [state.view]);

  const selectedCount = state.view === 'GIFTS' ? state.selected.length : 0;
  const selectedGifts = useMemo(() => {
    if (state.view === 'GIFTS' || state.view === 'THANKS') return state.selected;
    return [];
  }, [state]);

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

  const handleNoKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNoActivate();
    }
  };

  const handleSelectGift = (gift: Gift) => {
    if (state.view !== 'GIFTS' || isSubmitting) return;
    if (state.selected.length >= 2) return;

    incrementStat('giftSelections');
    if (state.selected.length === 1) {
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

  useEffect(() => {
    if (state.view !== 'GIFTS') return;
    if (state.selected.length !== 2) return;
    if (isSubmitting) return;

    const runSubmission = async () => {
      setIsSubmitting(true);
      const payload: SubmissionPayload = {
        name: state.name.trim(),
        gifts: state.selected,
        createdAt: new Date().toISOString()
      };
      const result = await submitSelection(payload);
      if (!result.ok) {
        const storage = getBrowserStorage();
        if (storage) {
          enqueueFailedSubmission(storage, payload, result.error);
          scheduleDrainFromStorage();
        }
      }
      incrementStat('completions');
      dispatch({ type: 'SUBMIT_RESULT', ok: result.ok, error: result.ok ? undefined : result.error });
      setIsSubmitting(false);
    };

    runSubmission();
  }, [state, isSubmitting]);

  return (
    <PageShell background={state.view === 'THANKS' ? 'sparkles' : 'romance'}>
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
                } as React.CSSProperties
              }
            />
          ))
        )}
      </div>
      {state.view === 'ASK' ? (
        <div className="flex flex-1 flex-col justify-center gap-10">
          <div className="valentine-panel mx-auto w-full max-w-3xl p-8 sm:p-12">
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center gap-4">
                <span className="valentine-chip">Valentine Collection</span>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-300">
                  {state.name.trim() ? `For ${state.name.trim()}` : 'For You'}
                </span>
              </div>
              <div className="space-y-4">
                <h1 className="text-balance text-3xl font-semibold leading-tight text-shadow-soft sm:text-5xl">
                  <span className="break-words text-rose-gradient">
                    {state.name.trim()
                      ? `${state.name.trim()}, Will You Be My Valentine?`
                      : 'Will You Be My Valentine?'}
                  </span>
                </h1>
                <p className="max-w-2xl text-base text-ink-300/90">
                  {state.name.trim()
                    ? `You’re stuck with me, ${state.name.trim()}. I dare you to click no.`
                    : 'You’re stuck with me. I dare you to click no.'}
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
                  <span className="text-rose-gradient">Pick Two</span>
                </h1>
                <p className="mt-2 text-base text-ink-300/90">
                  Two elegant treats, one effortless choice.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-rose-700 shadow-soft">
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-rose-600">
                  {selectedCount}/2
                </span>
                {selectedCount === 1 ? 'One More' : 'Make Your Selection'}
              </div>
            </div>
            {isSubmitting ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-600" aria-live="polite">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
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
                    disabled={isSubmitting || selectedCount >= 2}
                    isLeaving={leavingIds.has(gift.id)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <SelectedSummary selected={selectedGifts} />
              <Card>
                <div className="flex min-w-0 items-center gap-3 text-sm text-ink-400">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                    <FontAwesomeIcon icon={faGift} aria-hidden="true" />
                  </span>
                  <p className="break-words">
                    Your picks are saved the moment you choose. When you reach two, the note sends
                    automatically.
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
                    <span className="text-rose-gradient">You Chose Beautifully</span>
                  </h1>
                  <p className="text-base text-ink-300/90">
                    Your picks are set. Here is the recap.
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-300">
                    {state.name.trim() ? `Reserved for ${state.name.trim()}` : 'Reserved for You'}
                  </p>
                </div>

              {state.submitError ? (
                <div
                  className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  role="alert"
                >
                  <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Couldn’t send the notification.</p>
                    <p className="text-rose-700/80">Saved locally. Retry scheduled.</p>
                  </div>
                </div>
              ) : null}

              <h2 className="sr-only">Gift Recap</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {state.selected.map((gift) => (
                  <Card key={gift.id} className="bg-white/85">
                    <div className="flex min-w-0 items-start gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-500">
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
    </PageShell>
  );
}
