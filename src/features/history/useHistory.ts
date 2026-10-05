import { useEffect, useMemo, useState } from 'react';

import { listEntriesBetween } from '@/db/user/entries';
import { listWaterBetween } from '@/db/user/water';
import { entryViews } from '@/features/log/useDayLog';
import { totalsByDay, waterByDay, type DayTotals, type DayTrendTargets } from '@/lib/history';
import { targetsOnDay, useGoalsStore } from '@/stores/goals';
import { useLogStore } from '@/stores/log';
import { useWaterStore } from '@/stores/water';

export type Loaded<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error' };

/**
 * Reads something for a range of days, and reads it again whenever `revision` changes (an entry
 * or a water log was added, changed or deleted). Keeps showing the old value while re-reading.
 */
export function useRange<T>(
  from: string,
  to: string,
  revision: number,
  read: (from: string, to: string) => Promise<T>,
): Loaded<T> {
  const [state, setState] = useState<{ key: string; value: Loaded<T> } | null>(null);
  const key = `${from}|${to}`;

  useEffect(() => {
    let current = true;
    read(from, to)
      .then((value) => current && setState({ key, value: { status: 'ready', value } }))
      .catch(() => current && setState({ key, value: { status: 'error' } }));
    return () => {
      current = false;
    };
  }, [from, to, key, revision, read]);

  return state?.key === key ? state.value : { status: 'loading' };
}

async function readTotals(from: string, to: string): Promise<Map<string, DayTotals>> {
  const views = await entryViews(await listEntriesBetween(from, to));
  return totalsByDay(views.map((v) => ({ day: v.entry.day, nutrients: v.nutrients })));
}

async function readWater(from: string, to: string): Promise<Map<string, number>> {
  return waterByDay(await listWaterBetween(from, to));
}

/** Each day's totals from `from` to `to` (SPEC §5.3: worked out from the entries). */
export function useDayTotals(from: string, to: string): Loaded<Map<string, DayTotals>> {
  const revision = useLogStore((state) => state.revision);
  return useRange(from, to, revision, readTotals);
}

/** Each day's water in ml from `from` to `to`. */
export function useWaterByDay(from: string, to: string): Loaded<Map<string, number>> {
  const revision = useWaterStore((state) => state.revision);
  return useRange(from, to, revision, readWater);
}

/** The ml drunk on one day. 0 while loading. */
export function useWaterForDay(day: string): number {
  const water = useWaterByDay(day, day);
  return water.status === 'ready' ? (water.value.get(day) ?? 0) : 0;
}

/**
 * The targets in effect on any day (SPEC §4.2: the latest `targets` row that had started by
 * then), as Trends needs them.
 */
export function useTargetsFor(): (day: string) => DayTrendTargets | null {
  const rows = useGoalsStore((state) => state.targetRows);
  return useMemo(
    () => (day: string) => {
      const t = targetsOnDay(rows, day);
      return t && { kcal: t.kcal, protein_g: t.protein_g, carb_g: t.carb_g, fat_g: t.fat_g };
    },
    [rows],
  );
}
