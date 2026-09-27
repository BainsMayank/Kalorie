import type { DayTargets } from '@/lib/nutrition';
import { PLACEHOLDER_TARGETS } from '@/lib/placeholderTargets';

/**
 * The targets for a day. For now always the placeholder targets, marked as such so the screen
 * can say so; Stage 5 reads the `targets` row in effect on `day` (SPEC §4.2) instead.
 */
export function useDayTargets(_day: string): { targets: DayTargets; isPlaceholder: boolean } {
  return { targets: PLACEHOLDER_TARGETS, isPlaceholder: true };
}
