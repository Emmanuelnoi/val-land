export type ThemeKey = 'valentine' | 'birthday' | 'sage';

export type ThemeDefinition = {
  key: ThemeKey;
  label: string;
  description: string;
  preview: string[];
  confetti: string[];
};

export const THEMES: ThemeDefinition[] = [
  {
    key: 'valentine',
    label: 'Valentine',
    description: 'Romantic blush with soft glow.',
    preview: ['#f05d88', '#ff90b3', '#ffd4b2'],
    confetti: ['#FF90B3', '#F05D88', '#FFD4B2', '#FFE7F0', '#D94873', '#FFB3C7']
  },
  {
    key: 'birthday',
    label: 'Birthday',
    description: 'Warm coral and golden celebration.',
    preview: ['#ff8a5b', '#ffd166', '#ff6b6b'],
    confetti: ['#FF8A5B', '#FFD166', '#FF6B6B', '#FFE3B0', '#F26B4F', '#FFA07A']
  },
  {
    key: 'sage',
    label: 'Sage',
    description: 'Neutral greens with clean calm.',
    preview: ['#6c8f7d', '#a8c9a3', '#4e6b60'],
    confetti: ['#6C8F7D', '#A8C9A3', '#E1EFE7', '#93B7A5', '#4E6B60', '#CFE3D7']
  }
];

export const DEFAULT_THEME: ThemeKey = 'valentine';

export const THEME_KEYS = THEMES.map((theme) => theme.key);

export function isThemeKey(value: string): value is ThemeKey {
  return THEME_KEYS.includes(value as ThemeKey);
}

export function getTheme(key?: string): ThemeDefinition {
  const match = THEMES.find((theme) => theme.key === key);
  return match ?? THEMES[0];
}
