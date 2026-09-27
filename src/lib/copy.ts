// Copying a meal or a whole day to another day (SPEC §5.11).

import { clockMinute, timeOnDay } from './day';

/** What a copy carries over from an entry: the food, the amount, the meal and its time. */
export interface CopyableEntry {
  slotId: string;
  loggedAt: number;
  foodSource: 'base' | 'custom' | 'quick';
  foodId: string | null;
  name: string;
  qty: number | null;
  unit: string | null;
  grams: number | null;
  oilLevel: number;
  quickKcal: number | null;
  quickProteinG: number | null;
  quickCarbG: number | null;
  quickFatG: number | null;
  note: string | null;
}

export interface CopyTarget {
  day: string;
  /** Copy into this slot; leave out to keep each entry's own slot (copying a whole day). */
  slotId?: string;
}

/**
 * The new entries for a copy, in the same order. Food, amount, oil level and note stay the
 * same. The time of day stays the same when the slot does, so a copied day reads like the
 * original; moved to another slot, an entry takes that slot's start time (Lunch → Dinner at
 * 7:00 pm). Ids, the shared batch id and timestamps are added when saving.
 */
export function copyEntries(
  entries: readonly CopyableEntry[],
  target: CopyTarget,
  slots: readonly { id: string; startMin: number }[],
): (CopyableEntry & { day: string })[] {
  return entries.map((entry) => {
    const slotId = target.slotId ?? entry.slotId;
    const slot = slots.find((s) => s.id === slotId);
    const minute = slotId === entry.slotId || !slot ? clockMinute(entry.loggedAt) : slot.startMin;
    return {
      slotId,
      loggedAt: timeOnDay(target.day, minute),
      foodSource: entry.foodSource,
      foodId: entry.foodId,
      name: entry.name,
      qty: entry.qty,
      unit: entry.unit,
      grams: entry.grams,
      oilLevel: entry.oilLevel,
      quickKcal: entry.quickKcal,
      quickProteinG: entry.quickProteinG,
      quickCarbG: entry.quickCarbG,
      quickFatG: entry.quickFatG,
      note: entry.note,
      day: target.day,
    };
  });
}
