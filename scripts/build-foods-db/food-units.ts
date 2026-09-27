// Which units each food offers, their grams, and the default unit (SPEC §4.1 food_units, §5.2).

import { UNIT_DEFAULTS, mlToGrams } from '../../src/lib/units';
import type { CategoryUnits, DensityRule, UnitRule } from './curated';
import { ruleMatches } from './rules';
import type { FoodRecord, UnitRow } from './types';

export interface FoodUnitsResult {
  units: (UnitRow & { isDefault: boolean })[];
  defaultUnit: string;
  defaultQty: number;
  density: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Density: the first matching row of densities.csv, else the category's density. */
export function densityFor(
  normalizedName: string,
  category: string,
  rules: readonly DensityRule[],
  categoryUnits: CategoryUnits | undefined,
): number {
  const rule = rules.find((r) => ruleMatches(r.rule, normalizedName, category));
  return rule?.density ?? categoryUnits?.density ?? 1;
}

function standardGrams(unit: string, density: number): number | null {
  const std = UNIT_DEFAULTS.find((u) => u.unit === unit);
  if (!std) return null;
  return std.grams ?? mlToGrams(std.ml, density);
}

/**
 * Builds the unit list in priority order; the first source of a unit wins:
 * 1. unit_weights.csv rules (hand-checked), 2. the INDB serving, 3. USDA portions,
 * 4. the category's standard measures (katori, glass…) from ml × density.
 * "g" is always available in the app and isn't stored.
 */
export function buildFoodUnits(
  food: FoodRecord,
  normalizedName: string,
  categoryUnits: CategoryUnits | undefined,
  unitRules: readonly UnitRule[],
  densityRules: readonly DensityRule[],
): FoodUnitsResult {
  const density = densityFor(normalizedName, food.category, densityRules, categoryUnits);
  const rows = new Map<string, UnitRow>();
  const add = (row: UnitRow) => {
    if (!rows.has(row.unit) && row.grams > 0)
      rows.set(row.unit, { ...row, grams: round1(row.grams) });
  };

  const matched = unitRules.filter((r) => ruleMatches(r.rule, normalizedName, food.category));
  for (const r of matched) {
    const grams = r.grams ?? standardGrams(r.unit, density);
    if (grams !== null) add({ unit: r.unit, grams, label: r.label });
  }
  if (food.serving && !matched.some((r) => r.replaceServing)) add(food.serving);
  for (const p of food.portions) add(p);
  for (const unit of categoryUnits?.units ?? []) {
    const grams = standardGrams(unit, density);
    if (grams !== null) add({ unit, grams, label: unit });
  }

  const curatedDefault = matched.find((r) => r.isDefault)?.unit;
  const candidates = [
    ...(curatedDefault ? [curatedDefault] : []),
    ...(categoryUnits?.defaultUnits ?? []),
  ];
  const defaultUnit = candidates.find((u) => u === 'g' || rows.has(u)) ?? 'g';

  return {
    units: [...rows.values()].map((r) => ({ ...r, isDefault: r.unit === defaultUnit })),
    defaultUnit,
    defaultQty: defaultUnit === 'g' ? 100 : 1,
    density,
  };
}
