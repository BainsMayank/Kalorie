import type { TFunction } from 'i18next';

import type { LogEntry, MealSlot } from '@/db/user/schema';
import type { BuiltinSlotId } from '@/db/user/slots';

/** A slot's name: the one the user gave it, or the built-in name from en.json. */
export function slotName(t: TFunction, slot: Pick<MealSlot, 'id' | 'name'>): string {
  return slot.name ?? t(`slots.${slot.id as BuiltinSlotId}`);
}

/** An entry's name; a quick add without a label is called "Quick add". */
export function entryName(t: TFunction, entry: Pick<LogEntry, 'name'>): string {
  return entry.name || t('quickAdd.defaultName');
}
