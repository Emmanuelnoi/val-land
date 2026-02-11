import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const baseStyles =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-transform duration-200 focus-ring active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary shadow-soft',
  ghost: 'btn-ghost'
};

const sizeStyles: Record<ButtonSize, string> = {
  md: 'px-5 py-3 text-sm sm:text-base',
  lg: 'px-6 py-3.5 text-base'
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      className={[
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
}
