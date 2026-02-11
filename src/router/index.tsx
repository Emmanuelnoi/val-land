import React, { useCallback, useEffect, useMemo, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'recipient'; slug: string }
  | { name: 'results'; slug: string; key?: string };

type RouterContextValue = {
  route: Route;
  navigate: (to: string) => void;
};

const RouterContext = React.createContext<RouterContextValue | null>(null);

function parseRoute(pathname: string, search: string): Route {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  if (trimmed === '/') return { name: 'home' };
  if (trimmed === '/create') return { name: 'create' };

  const parts = trimmed.split('/').filter(Boolean);
  if (parts[0] === 'v' && parts[1]) {
    const slug = parts[1];
    if (parts[2] === 'results') {
      const params = new URLSearchParams(search);
      const key = params.get('key') ?? undefined;
      return { name: 'results', slug, key };
    }
    return { name: 'recipient', slug };
  }

  return { name: 'home' };
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const getRoute = () => parseRoute(window.location.pathname, window.location.search);
  const [route, setRoute] = useState<Route>(getRoute);

  useEffect(() => {
    const handlePop = () => setRoute(getRoute());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname + window.location.search) return;
    window.history.pushState({}, '', to);
    setRoute(parseRoute(window.location.pathname, window.location.search));
  }, []);

  const value = useMemo(() => ({ route, navigate }), [route, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const ctx = React.useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within RouterProvider');
  }
  return ctx;
}

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string;
};

export function Link({ to, onClick, ...props }: LinkProps) {
  const { navigate } = useRouter();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    onClick?.(event);
    if (event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };

  return <a href={to} {...props} onClick={handleClick} />;
}
