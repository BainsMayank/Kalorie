// The 35 nutrients Kalorie tracks (SPEC §3) and the formulas that convert source data into them.
// All values are per 100 g of edible food. `null` means "unknown", never zero.

export type NutrientGroup = 'energy' | 'macro' | 'other' | 'mineral' | 'vitamin';

export const NUTRIENTS = [
  { key: 'energy_kcal', unit: 'kcal', group: 'energy' },
  { key: 'protein_g', unit: 'g', group: 'macro' },
  { key: 'carb_g', unit: 'g', group: 'macro' },
  { key: 'fat_g', unit: 'g', group: 'macro' },
  { key: 'fibre_g', unit: 'g', group: 'other' },
  { key: 'sugar_g', unit: 'g', group: 'other' },
  { key: 'sat_fat_g', unit: 'g', group: 'other' },
  { key: 'mufa_g', unit: 'g', group: 'other' },
  { key: 'pufa_g', unit: 'g', group: 'other' },
  { key: 'trans_fat_g', unit: 'g', group: 'other' },
  { key: 'cholesterol_mg', unit: 'mg', group: 'other' },
  { key: 'sodium_mg', unit: 'mg', group: 'mineral' },
  { key: 'potassium_mg', unit: 'mg', group: 'mineral' },
  { key: 'calcium_mg', unit: 'mg', group: 'mineral' },
  { key: 'iron_mg', unit: 'mg', group: 'mineral' },
  { key: 'magnesium_mg', unit: 'mg', group: 'mineral' },
  { key: 'phosphorus_mg', unit: 'mg', group: 'mineral' },
  { key: 'zinc_mg', unit: 'mg', group: 'mineral' },
  { key: 'copper_mg', unit: 'mg', group: 'mineral' },
  { key: 'manganese_mg', unit: 'mg', group: 'mineral' },
  { key: 'selenium_ug', unit: 'µg', group: 'mineral' },
  { key: 'iodine_ug', unit: 'µg', group: 'mineral' },
  { key: 'vit_a_ug', unit: 'µg', group: 'vitamin' },
  { key: 'thiamine_mg', unit: 'mg', group: 'vitamin' },
  { key: 'riboflavin_mg', unit: 'mg', group: 'vitamin' },
  { key: 'niacin_mg', unit: 'mg', group: 'vitamin' },
  { key: 'pantothenic_mg', unit: 'mg', group: 'vitamin' },
  { key: 'vit_b6_mg', unit: 'mg', group: 'vitamin' },
  { key: 'biotin_ug', unit: 'µg', group: 'vitamin' },
  { key: 'folate_ug', unit: 'µg', group: 'vitamin' },
  { key: 'vit_b12_ug', unit: 'µg', group: 'vitamin' },
  { key: 'vit_c_mg', unit: 'mg', group: 'vitamin' },
  { key: 'vit_d_ug', unit: 'µg', group: 'vitamin' },
  { key: 'vit_e_mg', unit: 'mg', group: 'vitamin' },
  { key: 'vit_k_ug', unit: 'µg', group: 'vitamin' },
] as const satisfies readonly { key: string; unit: string; group: NutrientGroup }[];

export type NutrientKey = (typeof NUTRIENTS)[number]['key'];
export type NutrientValues = Record<NutrientKey, number | null>;

export const NUTRIENT_KEYS: readonly NutrientKey[] = NUTRIENTS.map((n) => n.key);

/** A full set of nutrients, all unknown. */
export function emptyNutrients(): NutrientValues {
  const values = {} as NutrientValues;
  for (const key of NUTRIENT_KEYS) values[key] = null;
  return values;
}

/**
 * The 35 nutrients out of a database row whose columns are named after them (`energy_kcal`…):
 * a `foods`, `custom_foods` or `recipe_items` row.
 */
export function pickNutrients(row: NutrientValues): NutrientValues {
  const values = {} as NutrientValues;
  for (const key of NUTRIENT_KEYS) values[key] = row[key];
  return values;
}

// --- Unit conversions -------------------------------------------------------------------

export const KJ_PER_KCAL = 4.184;

/** Kilojoules → kilocalories (IFCT reports energy in kJ). */
export function kjToKcal(kj: number | null): number | null {
  return kj === null ? null : kj / KJ_PER_KCAL;
}

/** Multiplies a value by a factor, keeping `null` as `null`. Used for g → mg (× 1000) and so on. */
export function scale(value: number | null, factor: number): number | null {
  return value === null ? null : value * factor;
}

/**
 * Adds values that belong together (vitamin D2 + D3, vitamin K1 + K2).
 * Unknown parts are skipped; if every part is unknown the total is unknown.
 */
export function sumKnown(...values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

/**
 * Available carbohydrate = carbohydrate "by difference" minus fibre (SPEC §3).
 * If fibre is unknown the value is returned as is. Never below zero.
 */
export function availableCarb(
  carbByDifference: number | null,
  fibre: number | null,
): number | null {
  if (carbByDifference === null) return null;
  return Math.max(0, carbByDifference - (fibre ?? 0));
}

/**
 * Energy from macros when a source has none: 4 kcal/g protein and carbs, 9 kcal/g fat.
 * Needs all three; returns `null` if any is unknown.
 */
export function estimateEnergyKcal(
  protein: number | null,
  carb: number | null,
  fat: number | null,
): number | null {
  if (protein === null || carb === null || fat === null) return null;
  return 4 * protein + 4 * carb + 9 * fat;
}

/**
 * Vitamin A in µg, with ICMR-NIN 2020's conversion factors (short report p. 10): retinol +
 * β-carotene / 6 + other provitamin-A carotenoids (α-carotene, β-cryptoxanthin) / 12.
 * (USDA's RAE uses 12 and 24, which gives half as much vitamin A from plant foods.)
 * Unknown parts count as zero, but if every part is unknown the result is unknown.
 */
export function vitaminAUg(parts: {
  retinolUg: number | null;
  betaCaroteneUg: number | null;
  otherCarotenoidsUg?: number | null;
}): number | null {
  const { retinolUg, betaCaroteneUg, otherCarotenoidsUg = null } = parts;
  if (retinolUg === null && betaCaroteneUg === null && otherCarotenoidsUg === null) return null;
  return (
    (retinolUg ?? 0) +
    (betaCaroteneUg ?? 0) / BETA_CAROTENE_PER_RETINOL +
    (otherCarotenoidsUg ?? 0) / OTHER_CAROTENOIDS_PER_RETINOL
  );
}

/** ICMR-NIN 2020 (p. 10): 6 µg β-carotene = 1 µg retinol; 12 µg for α-carotene, β-cryptoxanthin. */
export const BETA_CAROTENE_PER_RETINOL = 6;
export const OTHER_CAROTENOIDS_PER_RETINOL = 12;

/** Rounds to a number of decimals; `null` stays `null`. Keeps the database small and tidy. */
export function roundTo(value: number | null, decimals: number): number | null {
  if (value === null) return null;
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Share (0–1) of a group's nutrients that are known for a food. */
export function groupCoverage(values: NutrientValues, group: NutrientGroup): number {
  const inGroup = NUTRIENTS.filter((n) => n.group === group);
  const known = inGroup.filter((n) => values[n.key] !== null).length;
  return known / inGroup.length;
}

/** A group counts as complete when at least this share of it is known (same 80% rule as SPEC §5.10). */
export const COMPLETE_THRESHOLD = 0.8;

export interface CompletenessFlags {
  complete_macro: 0 | 1;
  complete_other: 0 | 1;
  complete_mineral: 0 | 1;
  complete_vitamin: 0 | 1;
}

/**
 * One flag per nutrient group. Macros are strict: energy, protein, carbs and fat must all be
 * known. The other groups use the 80% rule, because no source has every vitamin or mineral.
 */
export function completenessFlags(values: NutrientValues): CompletenessFlags {
  const flag = (ok: boolean): 0 | 1 => (ok ? 1 : 0);
  return {
    complete_macro: flag(
      groupCoverage(values, 'energy') === 1 && groupCoverage(values, 'macro') === 1,
    ),
    complete_other: flag(groupCoverage(values, 'other') >= COMPLETE_THRESHOLD),
    complete_mineral: flag(groupCoverage(values, 'mineral') >= COMPLETE_THRESHOLD),
    complete_vitamin: flag(groupCoverage(values, 'vitamin') >= COMPLETE_THRESHOLD),
  };
}
