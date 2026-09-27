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

/** What lists of logged, suggested or starred foods need about a food. */
export interface LoggedFood {
  id: number;
  name: string;
  source: FoodSource;
  nutrients: NutrientValues;
  /** unit → its label (without a number) and grams in 1 unit; `g` is always there. */
  units: Record<string, { label: string; grams: number }>;
  /** The food's usual portion, e.g. 1 katori = 150 g. */
  defaultPortion: { qty: number; unit: string; grams: number };
}

/**
 * Reads several foods at once (one query for the foods, one for their units). Foods that no
 * longer exist are left out of the map.
 */
export async function getLoggedFoods(
  db: ReadDb,
  ids: readonly number[],
): Promise<Map<number, LoggedFood>> {
  const result = new Map<number, LoggedFood>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return result;
  const marks = unique.map(() => '?').join(', ');

  const foods = await db.getAllAsync<
    {
      id: number;
      name: string;
      source: FoodSource;
      default_unit: string;
      default_qty: number;
    } & NutrientValues
  >(
    `SELECT id, name, source, default_unit, default_qty, ${NUTRIENT_KEYS.join(', ')}
       FROM foods WHERE id IN (${marks})`,
    unique,
  );
  const units = await db.getAllAsync<{
    food_id: number;
    unit: string;
    label: string;
    grams: number;
  }>(`SELECT food_id, unit, label, grams FROM food_units WHERE food_id IN (${marks})`, unique);
  const [gram] = await db.getAllAsync<{ label: string }>(
    `SELECT label FROM unit_defaults WHERE unit = 'g'`,
    [],
  );

  for (const food of foods) {
    const nutrients = {} as NutrientValues;
    for (const key of NUTRIENT_KEYS) nutrients[key] = food[key];
    result.set(food.id, {
      id: food.id,
      name: food.name,
      source: food.source,
      nutrients,
      units: { g: { label: gram?.label ?? 'g', grams: 1 } },
      defaultPortion: { qty: food.default_qty, unit: food.default_unit, grams: 0 },
    });
  }
  for (const u of units) {
    const food = result.get(u.food_id);
    if (food) food.units[u.unit] = { label: u.label, grams: u.grams };
  }
  for (const food of result.values()) {
    const unit = food.units[food.defaultPortion.unit];
    // A default unit without a weight falls back to 100 g.
    food.defaultPortion = unit
      ? { ...food.defaultPortion, grams: food.defaultPortion.qty * unit.grams }
      : { qty: 100, unit: 'g', grams: 100 };
  }
  return result;
}

/** Starter foods for a meal slot, in order (SPEC §4.1 `slot_suggestions`). */
export async function getSlotStarters(db: ReadDb, slot: string): Promise<number[]> {
  const rows = await db.getAllAsync<{ food_id: number }>(
    `SELECT food_id FROM slot_suggestions WHERE slot = ? ORDER BY position`,
    [slot],
  );
  return rows.map((r) => r.food_id);
}
