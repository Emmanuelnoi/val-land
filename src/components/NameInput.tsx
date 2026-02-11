import type { ChangeEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-solid-svg-icons';

type NameInputProps = {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
};

export default function NameInput({
  value,
  onChange,
  disabled,
  readOnly
}: NameInputProps) {
  const inputProps = onChange
    ? { value, onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value) }
    : { defaultValue: value };

  return (
    <label className="flex w-full flex-col gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-rose-500/80">
      <span className="flex items-center gap-2 text-[11px]">
        <FontAwesomeIcon icon={faUser} className="text-rose-400" aria-hidden="true" />
        Recipient Name
      </span>
      <div className="input-shell">
        <input
          type="text"
          {...inputProps}
          placeholder="e.g. Jordan…"
          maxLength={60}
          name="recipientName"
          autoComplete="off"
          disabled={disabled}
          readOnly={readOnly}
          className="w-full bg-transparent text-base font-medium text-ink-500 placeholder:text-ink-300 focus-ring"
          aria-label="Name"
        />
      </div>
    </label>
  );
}
