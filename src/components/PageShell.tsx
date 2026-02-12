import type { ReactNode } from 'react';
import type { ThemeKey } from '../lib/themes';

type PageShellProps = {
  children: ReactNode;
  background?: 'romance' | 'sparkles';
  theme?: ThemeKey;
};

export default function PageShell({
  children,
  background = 'romance',
  theme = 'red'
}: PageShellProps) {
  const bgClass = background === 'sparkles' ? 'bg-sparkles' : 'bg-romance';

  return (
    <div className={`${bgClass} valentine-shell min-h-screen`} data-theme={theme}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <main
        id="main-content"
        className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:px-8"
      >
        {children}
      </main>
    </div>
  );
}
