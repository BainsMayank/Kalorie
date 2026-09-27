// Links INDB recipe ingredients to foods and converts amounts to grams (SPEC §4.1
// recipe_ingredients, foods.yield_g; used by the oil adjuster §5.5).

import {
  NUTRIENT_KEYS,
  type NutrientValues,
  emptyNutrients,
  roundTo,
} from '../../src/lib/nutrients';
import { absorbedFryingOilGrams, per100WithoutPart } from '../../src/lib/oil';
import { normalizeText } from '../../src/lib/search';
import type { CategoryUnits, DensityRule } from './curated';
import { densityFor } from './food-units';
import {
  type RawIngredient,
  categoryFromCode,
  energyCheckRatio,
  isFatIngredient,
  recipeGrams,
} from './sources/indb-recipes';
import type { FoodRow } from './write';

export interface RecipeRow {
  position: number;
  ingredientFoodId: number | null;
  name: string;
  /**
   * Grams in the dish as eaten: 0 when INDB gives no usable amount (a few "colour" rows) or the
   * water never reaches the plate; for frying oil, only the part the food soaks up.
   */
  grams: number;
  isFat: boolean;
  /**
   * Per-100 g nutrients, copied only for fat ingredients (and water, all zero) — that's all the oil adjuster needs,
   * and other linked ingredients can be looked up by `ingredientFoodId`. Keeps foods.db small.
   */
  nutrients: NutrientValues;
}

export interface RecipeStats {
  dishes: number;
  rows: number;
  linkedIfct: number;
  linkedCurated: number;
  zero: number;
  unlinked: number;
  noGrams: number;
  /** Unlinked codes with how many rows use them, most used first. */
  unlinkedCodes: [string, number][];
  dishesWithFat: number;
  /** Dishes where the energy check could be done, and how many agree within ±5%. */
  energyChecked: number;
  energyWithin5pct: number;
  /** Dishes furthest from INDB's own kcal (name, ratio), for a look by hand. */
  energyOutliers: [string, number][];
  /** Dishes whose frying oil was cut to what the food soaks up, and grams of oil taken out. */
  fryingFixed: number;
  fryingOilRemovedG: number;
  /** Dishes with egg-boiling or steaming water taken out. */
  drainedFixed: number;
  /** Fixed recipe weight ÷ listed weight, per food id — INDB servings shrink by this much. */
  servingScale: Map<number, number>;
}

/** Finds the foods.db row for a ref, following refs that were removed as duplicates. */
export type FoodLookup = (ref: string) => FoodRow | undefined;

const ZERO = (() => {
  const values = emptyNutrients();
  for (const k of NUTRIENT_KEYS) values[k] = 0;
  return values;
})();

/**
 * Adds `recipe` and `yieldG` to every INDB dish row that has a recipe.
 * Throws if a fat ingredient isn't linked to a food: the oil adjuster needs its nutrients.
 */
export function attachRecipes(
  rows: FoodRow[],
  recipes: Map<string, RawIngredient[]>,
  ingredientMap: Map<string, string>,
  lookup: FoodLookup,
  densityRules: readonly DensityRule[],
  categoryUnits: Map<string, CategoryUnits>,
): RecipeStats {
  const stats: RecipeStats = {
    dishes: 0,
    rows: 0,
    linkedIfct: 0,
    linkedCurated: 0,
    zero: 0,
    unlinked: 0,
    noGrams: 0,
    unlinkedCodes: [],
    dishesWithFat: 0,
    energyChecked: 0,
    energyWithin5pct: 0,
    energyOutliers: [],
    fryingFixed: 0,
    fryingOilRemovedG: 0,
    drainedFixed: 0,
    servingScale: new Map(),
  };
  const unlinked = new Map<string, number>();
  const outliers: [string, number][] = [];

  for (const dish of rows) {
    if (dish.source !== 'indb') continue;
    const raw = recipes.get(dish.sourceCode);
    if (!raw) continue;
    stats.dishes++;

    let knownKcal = 0;
    let knownGrams = 0;
    let solidGrams = 0;
    let rawGrams = 0;
    const frying: RecipeRow[] = [];
    const drained: RecipeRow[] = [];
    const recipe: RecipeRow[] = raw.map((ing) => {
      stats.rows++;
      const curatedRef = ingredientMap.get(ing.code);
      const isZero = curatedRef === 'zero';
      const food = isZero
        ? undefined
        : (lookup(`ifct:${ing.code}`) ?? (curatedRef ? lookup(curatedRef) : undefined));
      if (curatedRef && !isZero && !food) {
        throw new Error(`indb_ingredients.csv: ${ing.code} → ${curatedRef} is not in foods.db`);
      }

      if (isZero) stats.zero++;
      else if (food?.source === 'ifct' && !curatedRef) stats.linkedIfct++;
      else if (food) stats.linkedCurated++;
      else {
        stats.unlinked++;
        const key = `${ing.code || '(no code)'} ${ing.name}`;
        unlinked.set(key, (unlinked.get(key) ?? 0) + 1);
      }

      const category = food?.category ?? categoryFromCode(ing.code);
      const density = isZero
        ? 1
        : (food?.density ??
          densityFor(normalizeText(ing.name), category, densityRules, categoryUnits.get(category)));
      const grams = recipeGrams(ing.amount, ing.unit, density);
      if (grams === null) stats.noGrams++;

      const isFat = isFatIngredient(ing.name, category);
      if (isFat && !food) {
        throw new Error(
          `${dish.sourceCode}: fat ingredient "${ing.name}" (${ing.code}) isn't linked — add it to indb_ingredients.csv`,
        );
      }

      const nutrients = isZero ? ZERO : (food?.nutrients ?? emptyNutrients());
      const g = grams ?? 0;
      rawGrams += g;
      if (!isZero) solidGrams += g;
      if (nutrients.energy_kcal !== null) {
        knownKcal += (g / 100) * nutrients.energy_kcal;
        if (!isZero) knownGrams += g;
      }
      const row: RecipeRow = {
        position: ing.position,
        ingredientFoodId: food?.id ?? null,
        name: ing.name,
        grams: roundTo(g, 2) ?? 0,
        isFat,
        // Fats carry their nutrients (the oil adjuster needs them) and so does water (all
        // zero, so it doesn't look "unknown"); everything else is looked up by food id.
        nutrients: isFat || isZero ? nutrients : emptyNutrients(),
      };
      if (isFat && ing.use === 'frying') frying.push(row);
      // Only water is taken out: it has no nutrients, so nothing else changes.
      if (isZero && ing.use === 'discarded') drained.push(row);
      return row;
    });

    dish.recipe = recipe;
    if (recipe.some((r) => r.isFat)) stats.dishesWithFat++;
    // The check compares with INDB as published, so it runs before the fixes below.
    const ratio = energyCheckRatio({
      knownKcal,
      knownGrams,
      solidGrams,
      rawGrams,
      dishKcalPer100: dish.nutrients.energy_kcal,
    });
    if (ratio !== null) {
      stats.energyChecked++;
      if (Math.abs(ratio - 1) <= 0.05) stats.energyWithin5pct++;
      else outliers.push([dish.name, ratio]);
    }

    const removedG = fixRecipe(dish, rawGrams, frying, drained, stats);
    // INDB's per-100 g values are per 100 g of the raw recipe, so that (minus what the fixes
    // took out) is the recipe weight the oil adjuster must use to stay consistent with them.
    dish.yieldG = rawGrams > 0 ? Math.round(rawGrams - removedG) : null;
    if (removedG > 0) stats.servingScale.set(dish.id, (rawGrams - removedG) / rawGrams);
  }

  stats.unlinkedCodes = [...unlinked.entries()].sort((a, b) => b[1] - a[1]);
  stats.energyOutliers = outliers.sort((a, b) => Math.abs(b[1] - 1) - Math.abs(a[1] - 1));
  return stats;
}

/**
 * INDB counts every ingredient as eaten. Two kinds aren't (SPEC §3):
 * - frying oil ("for deep frying", often 2 cups): only 15% of the other ingredients' weight
 *   stays in the food, the rest is left in the pan;
 * - water that never reaches the plate (boiling an egg, the steamer's water).
 * Takes them out of the dish's per-100 g values and the recipe rows, and returns the grams
 * taken out. Oil nutrients the database doesn't know count as 0 (nothing is taken out).
 */
function fixRecipe(
  dish: FoodRow,
  rawGrams: number,
  frying: RecipeRow[],
  drained: RecipeRow[],
  stats: RecipeStats,
): number {
  const fryingG = frying.reduce((n, r) => n + r.grams, 0);
  const drainedG = drained.reduce((n, r) => n + r.grams, 0);
  const keptOilG = absorbedFryingOilGrams(fryingG, rawGrams - fryingG - drainedG);
  const oilOutG = fryingG - keptOilG;
  const removedG = oilOutG + drainedG;
  if (removedG <= 0) return 0;

  const keep = fryingG > 0 ? keptOilG / fryingG : 1;
  for (const k of NUTRIENT_KEYS) {
    const oilOut = frying.reduce((n, r) => n + (r.grams / 100) * (r.nutrients[k] ?? 0), 0);
    const value = per100WithoutPart(dish.nutrients[k], rawGrams, removedG, (1 - keep) * oilOut);
    dish.nutrients[k] = roundTo(value, 3);
  }
  for (const r of frying) r.grams = roundTo(r.grams * keep, 2) ?? 0;
  for (const r of drained) r.grams = 0;

  if (oilOutG > 0) {
    stats.fryingFixed++;
    stats.fryingOilRemovedG += oilOutG;
  }
  if (drainedG > 0) stats.drainedFixed++;
  return removedG;
}
