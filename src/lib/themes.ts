export type ThemeKey =
  | 'valentine'
  | 'birthday-neutral'
  | 'birthday-men'
  | 'birthday-women'
  | 'primary-red'
  | 'primary-blue'
  | 'primary-yellow'
  | 'mono-dark'
  | 'mono-light';

type LegacyThemeKey = 'birthday' | 'sage' | 'sage-mist' | 'sage-olive' | 'sage-stone';

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
    key: 'primary-red',
    label: 'Primary Red',
    description: 'Crimson glow with soft blush.',
    preview: ['#e24b5d', '#ffb1bd', '#b83b4a'],
    confetti: ['#E24B5D', '#FFB1BD', '#F8D7DC', '#D63B50', '#FF879B', '#B83B4A']
  },
  {
    key: 'primary-blue',
    label: 'Primary Blue',
    description: 'Cobalt clarity with airy light.',
    preview: ['#2f5aa6', '#8cb7ff', '#1f3b5f'],
    confetti: ['#2F5AA6', '#8CB7FF', '#D9E6FF', '#1F3B5F', '#5F8FE0', '#3B73C4']
  },
  {
    key: 'primary-yellow',
    label: 'Primary Yellow',
    description: 'Sunlit gold with warm cream.',
    preview: ['#f2b03f', '#ffe08a', '#c2762f'],
    confetti: ['#F2B03F', '#FFE08A', '#FFF2C7', '#C2762F', '#F0C75B', '#E48A2C']
  },
  {
    key: 'mono-dark',
    label: 'Mono Dark',
    description: 'Charcoal polish with candlelight.',
    preview: ['#1f1f25', '#b9a07a', '#4b4b57'],
    confetti: ['#1F1F25', '#B9A07A', '#E6DED1', '#3B3B46', '#8A8A95', '#D2BFA0']
  },
  {
    key: 'mono-light',
    label: 'Mono Light',
    description: 'Pearl grey with quiet glow.',
    preview: ['#b7bcc5', '#f2f4f7', '#7d8590'],
    confetti: ['#B7BCC5', '#F2F4F7', '#E2E5EA', '#7D8590', '#9EA5B0', '#D6DAE1']
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
  if (value === 'sage' || value.startsWith('sage-')) return 'mono-light';
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
  if (normalized.startsWith('primary') || normalized.startsWith('mono')) return 'sage';
  return 'valentine';
}
