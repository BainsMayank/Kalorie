import { useCallback, useEffect, useRef, useState } from 'react';

import { listDeletedEntries, listEntriesForDay } from '@/db/user/entries';
import type { LogEntry } from '@/db/user/schema';
import { loadLoggedFoods } from '@/features/foods/loadFoods';
import type { NutrientValues } from '@/lib/nutrients';
import { entryNutrients } from '@/lib/nutrition';
import { foodKey } from '@/lib/suggestions';
import { useLogStore } from '@/stores/log';

/** One entry as the log shows it. */
export interface EntryView {
  entry: LogEntry;
  nutrients: NutrientValues;
  /** The unit as words ("medium roti"), or null for a quick add. */
  unitLabel: string | null;
}

type DayLog =
  { status: 'loading' } | { status: 'ready'; entries: EntryView[] } | { status: 'error' };

/** Entries with their nutrients and unit words, from the foods they were logged from. */
export async function entryViews(entries: readonly LogEntry[]): Promise<EntryView[]> {
  const foods = await loadLoggedFoods(entries);

  return entries.map((entry): EntryView => {
    const food =
      entry.foodId === null ? undefined : foods.get(foodKey(entry.foodSource, entry.foodId));
    return {
      entry,
      nutrients: entryNutrients(entry, food?.nutrients ?? null, food?.oilStep ?? null),
      unitLabel: entry.unit ? (food?.units[entry.unit]?.label ?? entry.unit) : null,
    };
  });
}

/**
 * A day's deleted entries that can still be brought back (SPEC §2.10 *Recently deleted*),
 * read again after every change. Empty while loading or if reading fails.
 */
export function useDeletedEntries(day: string): EntryView[] {
  const revision = useLogStore((state) => state.revision);
  const [state, setState] = useState<{ day: string; entries: EntryView[] }>({ day, entries: [] });

  useEffect(() => {
    let current = true;
    listDeletedEntries(day)
      .then(entryViews)
      .then((entries) => {
        if (current) setState({ day, entries });
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [day, revision]);

  return state.day === day ? state.entries : [];
}

/**
 * A day's entries with their nutrients, worked out from grams and the foods' per-100 g values
 * (SPEC §5.3). Reads again whenever an entry is added, changed or deleted; `reload` reads again
 * on request (pull to refresh) and finishes when the new entries are showing.
 */
export function useDayLog(day: string): DayLog & { reload: () => Promise<void> } {
  const revision = useLogStore((state) => state.revision);
  const [state, setState] = useState<{ day: string; value: DayLog } | null>(null);
  // Only the latest read may update the screen (an older, slower one would show stale entries).
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    let value: DayLog;
    try {
      value = { status: 'ready', entries: await entryViews(await listEntriesForDay(day)) };
    } catch {
      value = { status: 'error' };
    }
    if (request === latest.current) setState({ day, value });
  }, [day]);

  useEffect(() => {
    reload();
  }, [reload, revision]);

  // While a change is being read, keep showing the same day's entries (no flicker).
  const value = state?.day === day ? state.value : { status: 'loading' as const };
  return { ...value, reload };
}
