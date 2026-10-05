// Thalis — meals saved as a named template and logged again in one go (SPEC §2.9, §4.2).

/** A food in a thali, with the amount it was saved with. */
export interface ThaliItem {
  foodSource: 'base' | 'custom';
  foodId: string;
  name: string;
  qty: number;
  unit: string;
  /** Grams for `qty`. */
  grams: number;
  oilLevel: number;
}

/** What a thali is made from: a meal's log entries. */
export interface ThaliSourceEntry {
  foodSource: 'base' | 'custom' | 'quick';
  foodId: string | null;
  name: string;
  qty: number | null;
  unit: string | null;
  grams: number | null;
  oilLevel: number;
}

/**
 * The items for a thali saved from a meal, in the meal's order. Quick adds are left out: they
 * have no food to log again.
 */
export function thaliItemsFromEntries(entries: readonly ThaliSourceEntry[]): ThaliItem[] {
  return entries.flatMap((e) =>
    e.foodSource === 'quick' ||
    e.foodId === null ||
    e.qty === null ||
    e.unit === null ||
    e.grams === null
      ? []
      : [
          {
            foodSource: e.foodSource,
            foodId: e.foodId,
            name: e.name,
            qty: e.qty,
            unit: e.unit,
            grams: e.grams,
            oilLevel: e.oilLevel,
          },
        ],
  );
}

/**
 * Grams for a new quantity of a thali item: quantity × the food's grams in one unit, or — if the
 * food no longer has that unit — the saved grams scaled to the new quantity.
 */
export function thaliItemGrams(
  item: Pick<ThaliItem, 'qty' | 'grams'>,
  qty: number,
  unitGrams: number | null,
): number {
  if (unitGrams !== null) return qty * unitGrams;
  return item.qty > 0 ? (item.grams * qty) / item.qty : 0;
}

/** One row of the thali checklist: ticked or not, and the quantity as tweaked. */
export interface ThaliChoice {
  item: ThaliItem;
  checked: boolean;
  qty: number;
  /** Grams in one of the item's units, `null` if the food no longer has it. */
  unitGrams: number | null;
}

/**
 * The log entries for the ticked items (SPEC §2.9 *Log selected*), all at one time in one slot.
 * Items with no amount are skipped. They are saved together with one batch id (one Undo).
 */
export function thaliEntries(
  choices: readonly ThaliChoice[],
  target: { day: string; slotId: string; loggedAt: number },
) {
  return choices
    .filter((c) => c.checked && c.qty > 0)
    .map(({ item, qty, unitGrams }) => ({
      day: target.day,
      loggedAt: target.loggedAt,
      slotId: target.slotId,
      foodSource: item.foodSource,
      foodId: item.foodId,
      name: item.name,
      qty,
      unit: item.unit,
      grams: thaliItemGrams(item, qty, unitGrams),
      oilLevel: item.oilLevel,
    }));
}
