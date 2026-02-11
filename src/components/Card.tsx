import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={[
        'valentine-card border border-white/70 bg-white/90 p-5',
        className
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
