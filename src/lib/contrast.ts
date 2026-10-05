// WCAG 2.x colour contrast, used to check the theme tokens (SPEC §8.1).
// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio

/** Normal-size text needs at least this ratio against its background (WCAG AA). */
export const AA_TEXT = 4.5;
/** Chart bars, lines, icons and other shapes that carry meaning (WCAG 1.4.11). */
export const AA_GRAPHICS = 3;

/** Relative luminance of a `#RRGGBB` colour: 0 for black, 1 for white. */
export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(match[1].slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colours, from 1 (the same) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
