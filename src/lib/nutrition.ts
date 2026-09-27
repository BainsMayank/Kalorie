// Nutrients of a portion (SPEC §5.3). Foods store nutrients per 100 g; a portion's values are
// always worked out from its grams, never stored. Stage 3 adds day totals here.

import { NUTRIENT_KEYS, type NutrientValues } from './nutrients';

/** Nutrients in `grams` of a food: grams / 100 × the per-100 g value. Unknown stays unknown. */
export function nutrientsForGrams(per100g: NutrientValues, grams: number): NutrientValues {
  const result = {} as NutrientValues;
  for (const key of NUTRIENT_KEYS) {
    const value = per100g[key];
    result[key] = value === null ? null : (value * grams) / 100;
  }
  return result;
}
