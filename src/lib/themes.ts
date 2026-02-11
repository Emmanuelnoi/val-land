export type ThemeKey =
  | 'valentine'
  | 'birthday-neutral'
  | 'birthday-men'
  | 'birthday-women'
  | 'red'
  | 'yellow'
  | 'blue'
  | 'green'
  | 'mono-dark'
  | 'mono-light'
  | 'midnight';

type LegacyThemeKey =
  | 'birthday'
  | 'sage'
  | 'sage-mist'
  | 'sage-olive'
  | 'sage-stone'
  | 'primary-red'
  | 'primary-blue'
  | 'primary-yellow';

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
    key: 'red',
    label: 'Red',
    description: 'Deep garnet with warm embers.',
    preview: ['#8f1d2c', '#d75c44', '#4f0e1d'],
    confetti: ['#8F1D2C', '#D75C44', '#F2B4A2', '#B43B2A', '#F08A74', '#4F0E1D']
  },
  {
    key: 'yellow',
    label: 'Yellow',
    description: 'Saffron glow with soft citrus.',
    preview: ['#d9931a', '#ffe3a3', '#9a5d12'],
    confetti: ['#D9931A', '#FFE3A3', '#FFF2CC', '#B97512', '#F4C65C', '#9A5D12']
  },
  {
    key: 'blue',
    label: 'Blue',
    description: 'Azure clarity with midnight edge.',
    preview: ['#2f6fb5', '#9bd3ff', '#1b3458'],
    confetti: ['#2F6FB5', '#9BD3FF', '#DCEBFF', '#1B3458', '#5A93D9', '#3D78C2']
  },
  {
    key: 'green',
    label: 'Green',
    description: 'Emerald lift with fresh mint.',
    preview: ['#2f8f6b', '#a7e2c3', '#1f5b46'],
    confetti: ['#2F8F6B', '#A7E2C3', '#E3F6ED', '#1F5B46', '#63B391', '#2E7D64']
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
  },
  {
    key: 'midnight',
    label: 'Midnight',
    description: 'True dark with cool neon flicker.',
    preview: ['#0c111c', '#6dd3d6', '#1c2433'],
    confetti: ['#6DD3D6', '#9B9EFF', '#E6EAF2', '#354A6B', '#F0C06D', '#1C2433']
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
  if (value === 'primary-red') return 'red';
  if (value === 'primary-blue') return 'blue';
  if (value === 'primary-yellow') return 'yellow';
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
  if (
    normalized === 'red' ||
    normalized === 'yellow' ||
    normalized === 'blue' ||
    normalized === 'green' ||
    normalized.startsWith('mono') ||
    normalized === 'midnight'
  )
    return 'sage';
  return 'valentine';
}
