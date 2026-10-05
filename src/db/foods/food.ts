// One food with its nutrients and units, for the food detail screen.

import { NUTRIENT_KEYS, pickNutrients, type NutrientValues } from '@/lib/nutrients';
import {
  OIL_NUTRIENTS,
  genericOilStep,
  recipeOilStep,
  type OilNutrient,
  type OilStep,
} from '@/lib/oil';

import type { FoodDetail, FoodSource, FoodTag, FoodUnitOption, ReadDb } from './types';

type FoodRow = {
  id: number;
  name: string;
  name_hi: string | null;
  source: FoodSource;
  density_g_per_ml: number;
  default_unit: string;
  default_qty: number;
  energy_estimated: number;
  yield_g: number | null;
  cooked_with_fat: number;
} & NutrientValues;

/** What a food's oil control needs: its recipe weight and whether it is cooked with fat. */
interface OilInfo {
  id: number;
  yield_g: number | null;
  cooked_with_fat: number;
}

/**
 * The oil step (SPEC §5.5) of each food that has one: from its recipe's fat ingredients
 * (`recipe_ingredients`, INDB dishes), else 5 g of oil per 150 g for a food cooked with fat.
 */
async function readOilSteps(db: ReadDb, foods: readonly OilInfo[]): Promise<Map<number, OilStep>> {
  const result = new Map<number, OilStep>();
  if (foods.length === 0) return result;
  const ids = foods.map((f) => f.id);
  const rows = await db.getAllAsync<
    { recipe_food_id: number; grams: number; is_fat: number } & Record<OilNutrient, number | null>
  >(
    `SELECT recipe_food_id, grams, is_fat, ${OIL_NUTRIENTS.join(', ')}
       FROM recipe_ingredients
      WHERE recipe_food_id IN (${ids.map(() => '?').join(', ')})`,
    ids,
  );
  for (const food of foods) {
    const recipe = rows.filter((r) => r.recipe_food_id === food.id);
    const yieldG = food.yield_g ?? recipe.reduce((sum, r) => sum + r.grams, 0);
    const step = recipeOilStep(
      recipe.filter((r) => r.is_fat === 1).map((r) => ({ grams: r.grams, nutrients: r })),
      yieldG,
    );
    if (step) result.set(food.id, step);
    else if (food.cooked_with_fat === 1) result.set(food.id, genericOilStep());
  }
  return result;
}

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
    `SELECT id, name, name_hi, source, density_g_per_ml, default_unit, default_qty,
            energy_estimated, yield_g, cooked_with_fat, ${NUTRIENT_KEYS.join(', ')}
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

  return {
    foodSource: 'base',
    foodId: String(food.id),
    name: food.name,
    nameHi: food.name_hi,
    brand: null,
    barcode: null,
    labelPhotoUri: null,
    offStatus: null,
    source: food.source,
    densityGPerMl: food.density_g_per_ml,
    defaultUnit: units.some((u) => u.unit === food.default_unit) ? food.default_unit : 'g',
    defaultQty: food.default_qty,
    energyEstimated: food.energy_estimated === 1,
    nutrients: pickNutrients(food),
    oilStep: (await readOilSteps(db, [food])).get(food.id) ?? null,
    units,
  };
}

/** What lists of logged, suggested or starred foods need about a food. */
export interface LoggedFood {
  name: string;
  source: FoodTag;
  nutrients: NutrientValues;
  /** What Less / More oil changes per 100 g (SPEC §5.5); `null` = no oil control. */
  oilStep: OilStep | null;
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
      yield_g: number | null;
      cooked_with_fat: number;
    } & NutrientValues
  >(
    `SELECT id, name, source, default_unit, default_qty, yield_g, cooked_with_fat,
            ${NUTRIENT_KEYS.join(', ')}
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
  const oilSteps = await readOilSteps(db, foods);

  for (const food of foods) {
    result.set(food.id, {
      name: food.name,
      source: food.source,
      nutrients: pickNutrients(food),
      oilStep: oilSteps.get(food.id) ?? null,
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

/** A built-in starter thali (SPEC §4.1 `thali_templates`), its foods in order. */
export interface ThaliTemplate {
  id: number;
  name: string;
  items: { foodId: number; qty: number; unit: string }[];
}

/** The built-in starter thalis, in order. */
export async function getThaliTemplates(db: ReadDb): Promise<ThaliTemplate[]> {
  const thalis = await db.getAllAsync<{ id: number; name: string }>(
    `SELECT id, name FROM thali_templates ORDER BY id`,
    [],
  );
  const items = await db.getAllAsync<{
    template_id: number;
    food_id: number;
    qty: number;
    unit: string;
  }>(`SELECT template_id, food_id, qty, unit FROM thali_template_items ORDER BY position`, []);
  return thalis.map((thali) => ({
    id: thali.id,
    name: thali.name,
    items: items
      .filter((i) => i.template_id === thali.id)
      .map((i) => ({ foodId: i.food_id, qty: i.qty, unit: i.unit })),
  }));
}
