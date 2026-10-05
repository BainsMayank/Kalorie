import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { entryName } from '@/features/log/names';
import { useDayLog, type EntryView } from '@/features/log/useDayLog';
import { daySummary, type DayTargets } from '@/lib/nutrition';

import { useDayTargets } from './useDayTargets';

const NO_ENTRIES: EntryView[] = [];
const NO_TARGETS: DayTargets = { kcal: null, protein_g: null, carb_g: null, fat_g: null };

/**
 * A day's entries, its targets and everything the Today layout shows about it (ring, macros,
 * top foods). Used by Today and by a past day opened from the calendar.
 */
export function useDaySummary(day: string) {
  const { t } = useTranslation();
  const log = useDayLog(day);
  const targets = useDayTargets(day);
  const entries = log.status === 'ready' ? log.entries : NO_ENTRIES;
  const summary = useMemo(
    () =>
      daySummary(
        entries.map((view) => ({
          entryId: view.entry.id,
          foodSource: view.entry.foodSource,
          foodId: view.entry.foodId,
          name: entryName(t, view.entry),
          nutrients: view.nutrients,
        })),
        targets ?? NO_TARGETS,
      ),
    [entries, targets, t],
  );
  return { log, entries, targets, summary };
}
