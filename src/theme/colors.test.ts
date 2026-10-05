import { AA_GRAPHICS, AA_TEXT, contrastRatio } from '@/lib/contrast';

import { colors, type ColorScheme, type ColorTokens } from './colors';

// SPEC §8.1: both themes pass WCAG AA. If a test here fails after a colour change, pick a
// darker (light mode) or lighter (dark mode) shade of the same colour until it passes.

type Token = keyof ColorTokens;

/** Text can sit on any of these. */
const BACKGROUNDS: Token[] = ['background', 'surface', 'surfaceMuted'];
/** Text colours: normal text, secondary text, and inactive tab labels / future calendar days. */
const TEXT: Token[] = ['text', 'textSecondary', 'iconInactive'];
/** Calendar day tints: the day number on them is drawn in `text`. */
const FILLS: Token[] = ['onTargetFill', 'nearFill', 'farFill', 'partialFill'];
/** Accents drawn as chart bars, lines, dots and icons, on cards or the screen background. */
const ACCENTS: Token[] = [
  'protein',
  'carbs',
  'fat',
  'fibre',
  'water',
  'weight',
  'onTrack',
  'offTarget',
  'notice',
  'partial',
];

const SCHEMES: ColorScheme[] = ['light', 'dark'];

describe.each(SCHEMES)('%s theme', (scheme) => {
  const c = colors[scheme];

  it.each(TEXT.flatMap((fg) => BACKGROUNDS.map((bg) => [fg, bg])))(
    '%s text on %s passes AA (4.5:1)',
    (fg, bg) => {
      expect(contrastRatio(c[fg as Token], c[bg as Token])).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it.each(FILLS)('the day number on %s passes AA (4.5:1)', (fill) => {
    expect(contrastRatio(c.text, c[fill])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('the filled button (background-coloured text on a text-coloured box) passes AA', () => {
    expect(contrastRatio(c.background, c.text)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(ACCENTS.flatMap((accent) => ['background', 'surface'].map((bg) => [accent, bg])))(
    '%s shapes on %s pass the graphics minimum (3:1)',
    (accent, bg) => {
      expect(contrastRatio(c[accent as Token], c[bg as Token])).toBeGreaterThanOrEqual(AA_GRAPHICS);
    },
  );
});
