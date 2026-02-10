import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import type { SelectedGift } from '../lib/types';
import Card from './Card';

type SelectedSummaryProps = {
  selected: SelectedGift[];
};

export default function SelectedSummary({ selected }: SelectedSummaryProps) {
  return (
    <Card className="bg-white/80">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink-500">Your Selection</h2>
        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] tabular-nums text-rose-700">
          {selected.length}/2
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {selected.length === 0 ? (
          <p className="text-sm text-ink-300">No gifts selected yet.</p>
        ) : (
          selected.map((gift) => (
            <div key={gift.id} className="flex min-w-0 items-center gap-3 text-sm text-ink-400">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-500 shadow-soft">
                <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
              </span>
              <span className="break-words font-medium text-ink-500">{gift.title}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
