// Nutrition labels on packets (SPEC §2.8, §5.3). Indian labels usually print values per 100 g
// (or 100 ml for drinks) and per serving; Kalorie always stores per 100 g.

import { NUTRIENT_KEYS, emptyNutrients, type NutrientKey, type NutrientValues } from './nutrients';

/** What the numbers on a label are for. */
export type LabelBasis =
  | { per: '100g' }
  /** Drinks: per 100 ml, turned into grams with the density (1.0 unless known). */
  | { per: '100ml'; densityGPerMl: number }
  /** One serving of `servingG` grams. */
  | { per: 'serving'; servingG: number };

/**
 * What to multiply a label value by to get the value per 100 g (SPEC §5.3):
 * per serving → × 100 / serving grams; per 100 ml → ÷ density; per 100 g → × 1.
 * `null` when the serving size or density isn't a positive number.
 */
export function per100gFactor(basis: LabelBasis): number | null {
  switch (basis.per) {
    case '100g':
      return 1;
    case '100ml':
      return basis.densityGPerMl > 0 ? 1 / basis.densityGPerMl : null;
    case 'serving':
      return basis.servingG > 0 ? 100 / basis.servingG : null;
  }
}

/** A label value turned into per 100 g. Unknown stays unknown. */
export function toPer100g(value: number | null, basis: LabelBasis): number | null {
  const factor = per100gFactor(basis);
  if (value === null || factor === null) return null;
  return value * factor;
}

/**
 * Every value from a label turned into per 100 g. Nutrients left out of `values` (or `null`)
 * are unknown, never zero. Returns `null` if the basis can't be used (a serving of 0 g).
 */
export function labelToPer100g(
  values: Partial<Record<NutrientKey, number | null>>,
  basis: LabelBasis,
): NutrientValues | null {
  if (per100gFactor(basis) === null) return null;
  const result = emptyNutrients();
  for (const key of NUTRIENT_KEYS) result[key] = toPer100g(values[key] ?? null, basis);
  return result;
}

/** The label fields of the Add from label form (SPEC §2.8), in the order a label lists them. */
export const LABEL_FIELDS = [
  'energy_kcal',
  'protein_g',
  'carb_g',
  'sugar_g',
  'fat_g',
  'sat_fat_g',
  'trans_fat_g',
  'fibre_g',
  'sodium_mg',
  'cholesterol_mg',
] as const satisfies readonly NutrientKey[];

export type LabelField = (typeof LABEL_FIELDS)[number];

/** A unit a packet can be logged in, with grams in 1 unit. */
export interface ProductUnit {
  unit: 'serving' | 'pack' | 'ml';
  grams: number;
  isDefault: boolean;
}

/**
 * The units offered for a packet besides grams: 1 serving and 1 pack when their sizes are known
 * (pack only when it differs from the serving: a 70 g Maggi is one serving and one pack), and
 * ml for drinks. The default is a serving, else the pack, else grams (no row).
 */
export function productUnits(sizes: {
  servingG: number | null;
  packG: number | null;
  isLiquid: boolean;
  densityGPerMl?: number;
}): ProductUnit[] {
  const { servingG, packG, isLiquid, densityGPerMl = 1 } = sizes;
  const units: ProductUnit[] = [];
  const serving = servingG !== null && servingG > 0 ? servingG : null;
  const pack = packG !== null && packG > 0 && packG !== serving ? packG : null;
  if (serving !== null) units.push({ unit: 'serving', grams: serving, isDefault: true });
  if (pack !== null) units.push({ unit: 'pack', grams: pack, isDefault: serving === null });
  if (isLiquid) units.push({ unit: 'ml', grams: densityGPerMl, isDefault: false });
  return units;
}
