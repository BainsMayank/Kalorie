// Links INDB recipe ingredients to foods and converts amounts to grams (SPEC §4.1
// recipe_ingredients, foods.yield_g; used by the oil adjuster §5.5).

import {
  NUTRIENT_KEYS,
  type NutrientValues,
  emptyNutrients,
  roundTo,
} from '../../src/lib/nutrients';
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
  /** 0 when INDB gives no usable amount (a few "colour" rows). */
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
      return {
        position: ing.position,
        ingredientFoodId: food?.id ?? null,
        name: ing.name,
        grams: roundTo(g, 2) ?? 0,
        isFat,
        // Fats carry their nutrients (the oil adjuster needs them) and so does water (all
        // zero, so it doesn't look "unknown"); everything else is looked up by food id.
        nutrients: isFat || isZero ? nutrients : emptyNutrients(),
      };
    });

    dish.recipe = recipe;
    if (recipe.some((r) => r.isFat)) stats.dishesWithFat++;
    // INDB's per-100 g values are per 100 g of the raw recipe, so that is the recipe weight the
    // oil adjuster must use to stay consistent with them.
    dish.yieldG = rawGrams > 0 ? Math.round(rawGrams) : null;
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
  }

  stats.unlinkedCodes = [...unlinked.entries()].sort((a, b) => b[1] - a[1]);
  stats.energyOutliers = outliers.sort((a, b) => Math.abs(b[1] - 1) - Math.abs(a[1] - 1));
  return stats;
}
