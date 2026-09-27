// Oil / ghee adjuster for dishes with a recipe (SPEC §5.5), and the frying-oil fix the foods.db
// build applies to INDB recipes (SPEC §3).

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
