// Everyday foods with an everyday portion (SPEC §4.1 `common_foods`), for "foods rich in …" on
// the Nutrients screen.

import type { Diet, RichFoodCandidate } from '@/lib/micros';
import { NUTRIENT_KEYS, pickNutrients, type NutrientValues } from '@/lib/nutrients';

import type { ReadDb } from './types';

/** A common food with its portion's unit in words ("katori", "medium roti"). */
export interface CommonFood extends RichFoodCandidate {
  unitLabel: string;
}

/** Every common food, by name. */
export async function getCommonFoods(db: ReadDb): Promise<CommonFood[]> {
  const rows = await db.getAllAsync<
    {
      food_id: number;
      name: string;
      qty: number;
      unit: string;
      grams: number;
      diet: Diet;
      unit_label: string | null;
    } & NutrientValues
  >(
    `SELECT c.food_id, f.name, c.qty, c.unit, c.grams, c.diet,
            COALESCE(u.label, d.label) AS unit_label,
            ${NUTRIENT_KEYS.map((k) => `f.${k}`).join(', ')}
       FROM common_foods c
       JOIN foods f ON f.id = c.food_id
       LEFT JOIN food_units u ON u.food_id = c.food_id AND u.unit = c.unit
       LEFT JOIN unit_defaults d ON d.unit = c.unit
      ORDER BY f.name`,
    [],
  );
  return rows.map((row) => ({
    foodId: row.food_id,
    name: row.name,
    diet: row.diet,
    qty: row.qty,
    unit: row.unit,
    unitLabel: row.unit_label ?? row.unit,
    grams: row.grams,
    nutrients: pickNutrients(row),
  }));
}
