import type { TFunction } from 'i18next';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { listEntriesBetween } from '@/db/user/entries';
import { listWaterBetween } from '@/db/user/water';
import { entryName, slotName } from '@/features/log/names';
import { entryViews } from '@/features/log/useDayLog';
import { buildExport, exportFileName, type ExportData, type ExportFile } from '@/lib/export';
import { targetsOnDay, useGoalsStore } from '@/stores/goals';
import { useLogStore } from '@/stores/log';

/** Everything the four files need for the days `from`–`to`, read from user.db and foods.db. */
export async function loadExportData(t: TFunction, from: string, to: string): Promise<ExportData> {
  const [views, water] = await Promise.all([
    listEntriesBetween(from, to).then(entryViews),
    listWaterBetween(from, to),
  ]);
  const slots = new Map(useLogStore.getState().slots.map((s) => [s.id, s]));
  const { weighIns, targetRows } = useGoalsStore.getState();
  return {
    entries: views.map(({ entry, nutrients, unitLabel }) => {
      const slot = slots.get(entry.slotId);
      return {
        day: entry.day,
        loggedAt: entry.loggedAt,
        meal: slot ? slotName(t, slot) : '',
        name: entryName(t, entry),
        qty: entry.qty,
        unit: unitLabel,
        grams: entry.grams,
        nutrients,
      };
    }),
    water,
    weighIns: weighIns.map((w) => ({ day: w.day, kg: w.weightKg })),
    targetKcal: (day) => targetsOnDay(targetRows, day)?.kcal ?? null,
  };
}

/**
 * Writes one file to the app's cache folder and opens the phone's share sheet with it (save to
 * Files or Drive, send on WhatsApp or email…). Resolves once the share sheet is closed.
 */
export async function shareExportFile(
  t: TFunction,
  file: ExportFile,
  from: string,
  to: string,
): Promise<void> {
  const text = buildExport(await loadExportData(t, from, to), from, to)[file];
  const folder = new Directory(Paths.cache, 'export');
  folder.create({ idempotent: true, intermediates: true });
  const target = new File(folder, exportFileName(file, from, to));
  target.create({ overwrite: true });
  target.write(text);
  await Sharing.shareAsync(target.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: t(`export.files.${file}.name`),
  });
}
