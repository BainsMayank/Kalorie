// Units and grams (SPEC §5.2). Used by the foods.db build script and the food screens.

/** Standard household measures. Volumes are turned into grams with the food's density. */
export const UNIT_DEFAULTS = [
  { unit: 'katori', ml: 150, grams: null, label: 'katori' },
  { unit: 'glass', ml: 250, grams: null, label: 'glass' },
  { unit: 'cup', ml: 240, grams: null, label: 'cup' },
  { unit: 'tbsp', ml: 15, grams: null, label: 'tbsp' },
  { unit: 'tsp', ml: 5, grams: null, label: 'tsp' },
  { unit: 'ml', ml: 1, grams: null, label: 'ml' },
  { unit: 'g', ml: null, grams: 1, label: 'g' },
] as const;

export type StandardUnit = (typeof UNIT_DEFAULTS)[number]['unit'];

/** A per-food unit, as stored in `food_units` (e.g. "1 medium roti = 35 g"). */
export interface FoodUnit {
  unit: string;
  grams: number;
}

/** Millilitres → grams for a food of the given density (g per ml). */
export function mlToGrams(ml: number, densityGPerMl: number): number {
  return ml * densityGPerMl;
}

/**
 * Grams in one serving, worked out from any nutrient that is given both per serving and
 * per 100 g (INDB gives kcal both ways but not the serving weight).
 * Returns `null` when the per-100 g value is missing or zero.
 */
export function servingGrams(perServing: number | null, per100g: number | null): number | null {
  if (perServing === null || per100g === null || per100g <= 0) return null;
  return (perServing / per100g) * 100;
}

/**
 * Grams in 1 unit of a food (SPEC §5.2):
 * 1. the food's own unit row → its grams
 * 2. a standard unit with fixed grams (g = 1)
 * 3. a standard volume unit × the food's density (katori 150 ml × 1.0 = 150 g)
 * 4. otherwise `null` — the unit is not offered for this food.
 */
export function gramsPerUnit(
  unit: string,
  foodUnits: readonly FoodUnit[],
  densityGPerMl: number,
): number | null {
  const own = foodUnits.find((u) => u.unit === unit);
  if (own) return own.grams;
  const standard = UNIT_DEFAULTS.find((u) => u.unit === unit);
  if (!standard) return null;
  if (standard.grams !== null) return standard.grams;
  return mlToGrams(standard.ml, densityGPerMl);
}

/** Grams eaten for a quantity of a unit (e.g. 1.5 katori). `null` if the unit isn't valid. */
export function entryGrams(
  qty: number,
  unit: string,
  foodUnits: readonly FoodUnit[],
  densityGPerMl: number,
): number | null {
  const perUnit = gramsPerUnit(unit, foodUnits, densityGPerMl);
  return perUnit === null ? null : qty * perUnit;
}

/** Units measured in grams or millilitres: the amount is typed as a free number (SPEC §2.4). */
export function isFreeNumberUnit(unit: string): boolean {
  return unit === 'g' || unit === 'ml';
}

/**
 * How much the − / + buttons change the quantity (SPEC §2.4): 0.25 for katori, cup and glass,
 * 10 for grams and millilitres, and 0.5 for everything else (roti, piece, slice, tbsp, bowl…).
 */
export function quantityStep(unit: string): number {
  if (unit === 'katori' || unit === 'cup' || unit === 'glass') return 0.25;
  if (isFreeNumberUnit(unit)) return 10;
  return 0.5;
}

/**
 * The quantity to show after picking another unit. Switching to g or ml keeps the same amount
 * of food (1 katori → 150 g); switching to any other unit starts at 1 (2 roti → 1 katori).
 */
export function quantityForNewUnit(
  newUnit: string,
  newUnitGrams: number,
  currentGrams: number | null,
): number {
  if (isFreeNumberUnit(newUnit) && currentGrams !== null && newUnitGrams > 0) {
    return Math.max(1, Math.round(currentGrams / newUnitGrams));
  }
  return 1;
}

/**
 * The quantity after tapping − or + (SPEC §2.4): moves one step and snaps to the step size,
 * never going below one step (so 0.5 roti and 0.25 katori are possible, 0 is not).
 */
export function stepQuantity(qty: number, unit: string, direction: 1 | -1): number {
  const size = quantityStep(unit);
  const snapped = Math.round((qty + direction * size) / size) * size;
  // Round away floating-point dust (0.1 + 0.2 = 0.30000000000000004).
  return Math.max(size, Math.round(snapped * 1000) / 1000);
}
