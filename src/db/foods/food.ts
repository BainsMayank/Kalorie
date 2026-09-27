// One food with its nutrients and units, for the food detail screen.

import { NUTRIENT_KEYS, type NutrientValues } from '@/lib/nutrients';

import type { FoodDetail, FoodSource, FoodUnitOption, ReadDb } from './types';

type FoodRow = {
  id: number;
  name: string;
  name_hi: string | null;
  source: FoodSource;
  kind: 'ingredient' | 'dish';
  density_g_per_ml: number;
  default_unit: string;
  default_qty: number;
  energy_estimated: number;
} & NutrientValues;

interface UnitRow {
  unit: string;
  label: string;
  grams: number;
  is_default: number;
}

/**
 * Reads a food, or `null` if there is no food with this id. Its units come from `food_units`
 * (every unit it offers has a row, SPEC §4.1), plus grams, which every food has.
 */
export async function getFoodDetail(db: ReadDb, id: number): Promise<FoodDetail | null> {
  const [food] = await db.getAllAsync<FoodRow>(
    `SELECT id, name, name_hi, source, kind, density_g_per_ml, default_unit, default_qty,
            energy_estimated, ${NUTRIENT_KEYS.join(', ')}
       FROM foods WHERE id = ?`,
    [id],
  );
  if (!food) return null;

  const unitRows = await db.getAllAsync<UnitRow>(
    `SELECT unit, label, grams, is_default FROM food_units
      WHERE food_id = ? ORDER BY is_default DESC, grams`,
    [id],
  );
  const [gram] = await db.getAllAsync<{ label: string }>(
    `SELECT label FROM unit_defaults WHERE unit = 'g'`,
    [],
  );
  const units: FoodUnitOption[] = unitRows.map((u) => ({
    unit: u.unit,
    label: u.label,
    grams: u.grams,
    isDefault: u.is_default === 1,
  }));
  units.push({ unit: 'g', label: gram?.label ?? 'g', grams: 1, isDefault: units.length === 0 });

  const nutrients = {} as NutrientValues;
  for (const key of NUTRIENT_KEYS) nutrients[key] = food[key];

  return {
    id: food.id,
    name: food.name,
    nameHi: food.name_hi,
    source: food.source,
    kind: food.kind,
    densityGPerMl: food.density_g_per_ml,
    defaultUnit: units.some((u) => u.unit === food.default_unit) ? food.default_unit : 'g',
    defaultQty: food.default_qty,
    energyEstimated: food.energy_estimated === 1,
    nutrients,
    units,
  };
}
