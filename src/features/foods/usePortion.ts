import { useState } from 'react';

import type { FoodDetail, FoodUnitOption } from '@/db/foods';
import { formatQty } from '@/lib/format';
import { nutrientsForGrams } from '@/lib/nutrition';
import { entryGrams, quantityForNewUnit, stepQuantity } from '@/lib/units';

/** Reads a typed amount: "1.5" or "1,5" → 1.5; anything else → 0. */
export function parseQty(text: string): number {
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * The amount being chosen for a food: unit, quantity (as typed), grams and nutrients.
 * Starts at `start` (e.g. an entry being edited) or at the food's usual portion.
 */
export function usePortion(food: FoodDetail, start?: { unit: string; qty: number }) {
  const [unit, setUnit] = useState<FoodUnitOption>(
    () =>
      food.units.find((u) => u.unit === (start?.unit ?? food.defaultUnit)) ??
      food.units.find((u) => u.unit === food.defaultUnit) ??
      food.units[0],
  );
  const [qtyText, setQtyText] = useState(() =>
    formatQty(
      start && start.unit === unit.unit
        ? start.qty
        : unit.unit === food.defaultUnit
          ? food.defaultQty
          : 1,
    ),
  );

  const qty = parseQty(qtyText);
  const grams = entryGrams(qty, unit.unit, food.units, food.densityGPerMl) ?? qty * unit.grams;
  const nutrients = nutrientsForGrams(food.nutrients, grams);

  const pickUnit = (next: FoodUnitOption) => {
    setQtyText(formatQty(quantityForNewUnit(next.unit, next.grams, grams)));
    setUnit(next);
  };
  const step = (direction: 1 | -1) =>
    setQtyText(formatQty(stepQuantity(qty, unit.unit, direction)));

  return { unit, qtyText, setQtyText, qty, grams, nutrients, pickUnit, step };
}
