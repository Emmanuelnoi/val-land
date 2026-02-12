import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ThemeDefinition, ThemeKey } from '../lib/themes';
import { DEFAULT_THEME, getTheme } from '../lib/themes';

type ThemeContextValue = {
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
  activeTheme: ThemeDefinition;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeKey>(DEFAULT_THEME);
  const activeTheme = useMemo(() => getTheme(theme), [theme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isDarkTheme = theme === 'midnight' || theme === 'lavender-noir';
    const themeColor = isDarkTheme ? '#0b0f18' : '#f6ebf1';

    document.documentElement.style.colorScheme = isDarkTheme ? 'dark' : 'light';

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, activeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
