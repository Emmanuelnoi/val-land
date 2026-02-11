import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGift, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import type { Gift } from '../lib/types';
import Button from './Button';
import Card from './Card';

type GiftCardProps = {
  gift: Gift;
  onSelect: (gift: Gift) => void;
  disabled?: boolean;
  isLeaving?: boolean;
};

export default function GiftCard({ gift, onSelect, disabled, isLeaving }: GiftCardProps) {
  return (
    <Card
      className={[
        'group flex h-full flex-col gap-4 transition-transform transition-opacity duration-200 hover:-translate-y-1 hover:shadow-lift',
        isLeaving ? 'pointer-events-none opacity-0 scale-95' : 'opacity-100'
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="relative overflow-hidden rounded-2xl">
        <img
          src={gift.imageUrl}
          alt={gift.title}
          width={640}
          height={352}
          className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-500/35 via-transparent to-white/30 opacity-80" />
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <div className="space-y-2">
          <h3 className="break-words text-lg font-semibold text-ink-500">{gift.title}</h3>
          <p className="break-words text-sm text-ink-300/90">{gift.description}</p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-3">
          {gift.linkUrl ? (
            <a
              href={gift.linkUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="link-soft inline-flex items-center gap-2 focus-ring"
              aria-label={`View ${gift.title}`}
            >
              View
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
            </a>
          ) : null}
          <Button
            variant="primary"
            size="md"
            className="ml-auto"
            onClick={() => onSelect(gift)}
            disabled={disabled}
            aria-label={`Select ${gift.title}`}
          >
            <FontAwesomeIcon icon={faGift} aria-hidden="true" />
            Select
          </Button>
        </div>
      </div>
    </Card>
  );
}
