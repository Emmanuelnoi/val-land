export type ThemeKey =
  | 'valentine'
  | 'birthday-neutral'
  | 'birthday-men'
  | 'birthday-women'
  | 'sage-mist'
  | 'sage-olive'
  | 'sage-stone';

type LegacyThemeKey = 'birthday' | 'sage';

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
    key: 'birthday-neutral',
    label: 'Birthday Neutral',
    description: 'Warm coral with golden celebration.',
    preview: ['#ff8a5b', '#ffd166', '#ff6b6b'],
    confetti: ['#FF8A5B', '#FFD166', '#FF6B6B', '#FFE3B0', '#F26B4F', '#FFA07A']
  },
  {
    key: 'birthday-men',
    label: 'Birthday Bold',
    description: 'Deep navy with electric accents.',
    preview: ['#1f3b5f', '#2f5aa6', '#f2b03f'],
    confetti: ['#1F3B5F', '#2F5AA6', '#F2B03F', '#F2C06D', '#3B73C4', '#F28F3B']
  },
  {
    key: 'birthday-women',
    label: 'Birthday Blush',
    description: 'Soft berry with champagne glow.',
    preview: ['#f26a8d', '#ffd1dc', '#c85a84'],
    confetti: ['#F26A8D', '#FFD1DC', '#C85A84', '#FFE5EC', '#FF9EB5', '#E56B8C']
  },
  {
    key: 'sage-mist',
    label: 'Sage Mist',
    description: 'Neutral greens with clean calm.',
    preview: ['#6c8f7d', '#a8c9a3', '#4e6b60'],
    confetti: ['#6C8F7D', '#A8C9A3', '#E1EFE7', '#93B7A5', '#4E6B60', '#CFE3D7']
  },
  {
    key: 'sage-olive',
    label: 'Sage Olive',
    description: 'Earthy olive with muted warmth.',
    preview: ['#6f7a4f', '#c1c69f', '#47543a'],
    confetti: ['#6F7A4F', '#C1C69F', '#A0A682', '#DDE1C2', '#47543A', '#8A9362']
  },
  {
    key: 'sage-stone',
    label: 'Sage Stone',
    description: 'Cool stone greens with soft contrast.',
    preview: ['#5d7568', '#cfdad5', '#3f5148'],
    confetti: ['#5D7568', '#CFDAD5', '#9FB1AA', '#E8EFEC', '#3F5148', '#7B8E85']
  }
];

export const DEFAULT_THEME: ThemeKey = 'valentine';

export const THEME_KEYS = THEMES.map((theme) => theme.key);

export function isThemeKey(value: string): value is ThemeKey {
  return THEME_KEYS.includes(value as ThemeKey);
}

export function normalizeThemeKey(value?: string): ThemeKey {
  if (!value) return DEFAULT_THEME;
  if (isThemeKey(value)) return value;
  if (value === 'birthday') return 'birthday-neutral';
  if (value === 'sage') return 'sage-mist';
  return DEFAULT_THEME;
}

export function getTheme(key?: string): ThemeDefinition {
  const normalized = normalizeThemeKey(key);
  const match = THEMES.find((theme) => theme.key === normalized);
  return match ?? THEMES[0];
}

export function getThemeFamily(key: ThemeKey | LegacyThemeKey) {
  const normalized = normalizeThemeKey(key);
  if (normalized.startsWith('birthday')) return 'birthday';
  if (normalized.startsWith('sage')) return 'sage';
  return 'valentine';
}
