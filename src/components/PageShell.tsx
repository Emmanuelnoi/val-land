import React from 'react';

type PageShellProps = {
  children: React.ReactNode;
  background?: 'romance' | 'sparkles';
};

export default function PageShell({ children, background = 'romance' }: PageShellProps) {
  const bgClass = background === 'sparkles' ? 'bg-sparkles' : 'bg-romance';

  return (
    <div className={`${bgClass} valentine-shell min-h-screen`}>
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
