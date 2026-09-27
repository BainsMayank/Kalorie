// Spacing, corner radius and text sizes shared by light and dark mode.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const fontSize = {
  caption: 13,
  body: 16,
  title: 20,
  headline: 28,
} as const;

// SPEC §8.2: every tap target is at least 48 dp.
export const minTapTarget = 48;
