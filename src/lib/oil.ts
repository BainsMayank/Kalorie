// Oil / ghee adjuster (SPEC §5.5), and the frying-oil fix the foods.db build applies to INDB
// recipes (SPEC §3).

import type { NutrientKey, NutrientValues } from './nutrients';

/** Oil level stored on a log entry: −1 Less, 0 Normal, +1 More. */
export type OilLevel = -1 | 0 | 1;

/** Multiplier for the recipe's fat: Less 0.5×, Normal 1×, More 1.5×. */
export function oilFactor(level: OilLevel): number {
  return level === -1 ? 0.5 : level === 1 ? 1.5 : 1;
}

/**
 * A nutrient per 100 g of a dish after scaling its cooking fat (oil, ghee, butter) by `factor`.
 *
 *   dishTotal = per100 × yield / 100               (the whole pot, as the database says)
 *   adjusted  = (dishTotal + (factor − 1) × fatTotal) / (yield + (factor − 1) × fatGrams) × 100
 *
 * This is SPEC §5.5 with N_rest = dishTotal − fatTotal, so ingredients whose nutrients we don't
 * know don't matter — only the fats do. At factor 1 it returns `per100` unchanged.
 *
 * @param per100    the dish's value per 100 g (kcal, fat g, …); `null` stays `null`
 * @param fatTotal  that nutrient summed over the fat ingredients (grams/100 × their per-100 g value)
 * @param fatGrams  grams of fat ingredients in the recipe
 * @param yieldG    cooked weight of the whole recipe
 */
export function oilAdjustedPer100(
  per100: number | null,
  fatTotal: number,
  fatGrams: number,
  yieldG: number,
  factor: number,
): number | null {
  // Scaling the fat by `factor` is the same as taking (1 − factor) of it out (a negative
  // amount for More adds it back in).
  return per100WithoutPart(per100, yieldG, (1 - factor) * fatGrams, (1 - factor) * fatTotal);
}

/**
 * A nutrient per 100 g of a recipe after taking part of it out — frying oil left in the pan,
 * or soaking water poured away:
 *
 *   (per100 × yield / 100 − removedTotal) / (yield − removedGrams) × 100
 *
 * Never below zero: you can't remove more of a nutrient than the whole recipe contains.
 *
 * @param per100        the recipe's value per 100 g; `null` stays `null`
 * @param yieldG        weight of the whole recipe that `per100` refers to
 * @param removedGrams  grams taken out (negative adds)
 * @param removedTotal  that nutrient in what's taken out (grams/100 × its per-100 g value)
 */
export function per100WithoutPart(
  per100: number | null,
  yieldG: number,
  removedGrams: number,
  removedTotal: number,
): number | null {
  if (per100 === null || yieldG <= 0) return per100;
  const total = Math.max(0, (per100 * yieldG) / 100 - removedTotal);
  const weight = yieldG - removedGrams;
  return weight > 0 ? (total / weight) * 100 : per100;
}

/**
 * Share of the other ingredients' weight that a deep-fried food soaks up as oil. INDB recipes
 * list the whole pan of frying oil (often 2 cups) and count all of it as eaten; in reality most
 * of it stays in the pan. 15% gives believable values for samosa, poori, pakora and vada.
 */
export const FRYING_OIL_ABSORBED = 0.15;

/** Grams of frying oil that end up in the food: 15% of everything else, at most what's listed. */
export function absorbedFryingOilGrams(listedOilG: number, otherIngredientsG: number): number {
  return Math.max(0, Math.min(listedOilG, FRYING_OIL_ABSORBED * otherIngredientsG));
}

// --- Less / Normal / More on a logged portion (SPEC §5.5) ----------------------------------

/**
 * The nutrients the oil control moves: energy and the fats. Protein, carbs, fibre, minerals and
 * vitamins stay as they are — the same katori of dal, just with less or more ghee in it.
 */
export const OIL_NUTRIENTS = [
  'energy_kcal',
  'fat_g',
  'sat_fat_g',
  'mufa_g',
  'pufa_g',
  'trans_fat_g',
  'cholesterol_mg',
] as const satisfies readonly NutrientKey[];

export type OilNutrient = (typeof OIL_NUTRIENTS)[number];

/**
 * What one step of the oil control (Less → Normal or Normal → More) adds to 100 g of a dish.
 * A dish without cooking fat has no step (`null`) and shows no oil control.
 */
export type OilStep = Record<OilNutrient, number>;

/** An ingredient of a recipe: its grams and its nutrients per 100 g (unknown counts as none). */
export interface FatIngredient {
  grams: number;
  nutrients: Partial<Record<NutrientKey, number | null>>;
}

/**
 * The oil step of a dish with a recipe: half of its fat ingredients (Less = 0.5×, More = 1.5×),
 * per 100 g of the dish.
 *
 *   step(n) = 0.5 × Σ fat grams / 100 × fat(n)  ÷  yield × 100
 *
 * @param fats    the recipe's fat ingredients (oil, ghee, butter…)
 * @param yieldG  the weight the dish's per-100 g values refer to
 */
export function recipeOilStep(fats: readonly FatIngredient[], yieldG: number): OilStep | null {
  const fatGrams = fats.reduce((sum, f) => sum + f.grams, 0);
  if (fatGrams <= 0 || yieldG <= 0) return null;
  const step = {} as OilStep;
  for (const key of OIL_NUTRIENTS) {
    const inRecipe = fats.reduce((sum, f) => sum + (f.grams / 100) * (f.nutrients[key] ?? 0), 0);
    step[key] = ((0.5 * inRecipe) / yieldG) * 100;
  }
  return step;
}

/**
 * Sunflower oil, per 100 g (INDB "Oil, sunflower"): the oil used for foods that are cooked with
 * fat but have no recipe to take it from.
 */
export const GENERIC_OIL: OilStep = {
  energy_kcal: 900,
  fat_g: 100,
  sat_fat_g: 11.39,
  mufa_g: 25.96,
  pufa_g: 62.65,
  trans_fat_g: 0,
  cholesterol_mg: 0,
};

/** Grams of oil one step adds to a katori-sized 150 g of a dish without a recipe. */
export const OIL_STEP_G_PER_150G = 5;

/** The oil step of a food cooked with fat but without a recipe: 5 g of oil per 150 g. */
export function genericOilStep(): OilStep {
  const step = {} as OilStep;
  for (const key of OIL_NUTRIENTS) {
    step[key] = (GENERIC_OIL[key] * OIL_STEP_G_PER_150G) / 150;
  }
  return step;
}

/**
 * A portion's nutrients at an oil level:
 *
 *   value(n) = portion(n) + level × step(n) × grams / 100      (level −1, 0 or +1)
 *
 * Only energy and the fats change. A value that is unknown stays unknown, and none goes below
 * zero (Less can't take out more fat than the portion has).
 */
export function withOilLevel(
  portion: NutrientValues,
  step: OilStep | null,
  grams: number,
  level: number,
): NutrientValues {
  if (step === null || level === 0 || grams <= 0) return portion;
  const result = { ...portion };
  for (const key of OIL_NUTRIENTS) {
    const value = portion[key];
    if (value !== null) result[key] = Math.max(0, value + (level * step[key] * grams) / 100);
  }
  return result;
}
