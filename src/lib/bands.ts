// Words instead of numbers for hide-numbers mode (SPEC §8.3). The ring, the macro bars and the
// vitamin and mineral bars keep their shapes; the text beside them says roughly where they are.

/** Where a share of a target (0 = nothing, 1 = the whole target) falls. */
export type ShareBand = 'start' | 'half' | 'nearly' | 'around' | 'more';

/**
 * SPEC §8.3: < 25% just getting started · 25–60% about halfway · 60–90% nearly there ·
 * 90–110% around your target · > 110% a bit more than planned.
 */
export function shareBand(share: number): ShareBand {
  if (share < 0.25) return 'start';
  if (share < 0.6) return 'half';
  if (share < 0.9) return 'nearly';
  if (share <= 1.1) return 'around';
  return 'more';
}
