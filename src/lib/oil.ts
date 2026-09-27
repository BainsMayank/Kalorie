// Oil / ghee adjuster for dishes with a recipe (SPEC §5.5).

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
  if (per100 === null || yieldG <= 0) return per100;
  const dishTotal = (per100 * yieldG) / 100;
  // "Less" can't remove more of a nutrient than the whole dish contains.
  const total = Math.max(0, dishTotal + (factor - 1) * fatTotal);
  const weight = yieldG + (factor - 1) * fatGrams;
  return weight > 0 ? (total / weight) * 100 : per100;
}
