import { useMemo } from 'react';

import type { TargetValues } from '@/lib/targets';
import { targetsOnDay, useGoalsStore } from '@/stores/goals';

/**
 * The targets in effect on `day` (SPEC §4.2): the latest `targets` row that had started by then.
 * `null` only if no targets were ever saved (onboarding always saves some).
 */
export function useDayTargets(day: string): TargetValues | null {
  const rows = useGoalsStore((state) => state.targetRows);
  return useMemo(() => targetsOnDay(rows, day), [rows, day]);
}
