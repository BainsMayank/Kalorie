import { useCallback, useEffect, useRef, useState } from 'react';

import { getFoodsDb, getLoggedFoods } from '@/db/foods';
import { listEntriesForDay } from '@/db/user/entries';
import type { LogEntry } from '@/db/user/schema';
import type { NutrientValues } from '@/lib/nutrients';
import { entryNutrients } from '@/lib/nutrition';
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

/** A day's entries with their nutrients, read from user.db and foods.db. */
async function readDay(day: string): Promise<EntryView[]> {
  const entries = await listEntriesForDay(day);
  const ids = entries.filter((e) => e.foodSource === 'base').map((e) => Number(e.foodId));
  const foods = ids.length > 0 ? await getLoggedFoods(await getFoodsDb(), ids) : new Map();

  return entries.map((entry): EntryView => {
    const food = entry.foodSource === 'base' ? foods.get(Number(entry.foodId)) : undefined;
    return {
      entry,
      nutrients: entryNutrients(entry, food?.nutrients ?? null),
      unitLabel: entry.unit ? (food?.units[entry.unit]?.label ?? entry.unit) : null,
    };
  });
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
      value = { status: 'ready', entries: await readDay(day) };
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
