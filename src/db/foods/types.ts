// Types for reading foods.db (SPEC §4.1).

import type { NutrientValues } from '@/lib/nutrients';

export type SqlValue = string | number | null;

/**
 * The one database method the food queries need. expo-sqlite's database has it, and tests
 * wrap Node's built-in SQLite in the same shape, so the queries run against the real foods.db.
 */
export interface ReadDb {
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
}

export type FoodSource = 'indb' | 'ifct' | 'usda_fnd' | 'usda_sr';

/** One row in the search results list. */
export interface FoodSearchResult {
  id: number;
  name: string;
  nameHi: string | null;
  source: FoodSource;
  /** The food's usual portion, e.g. 1 katori. */
  defaultQty: number;
  defaultUnit: string;
  /** The unit's label without a number: "katori", "medium roti", "g". */
  defaultUnitLabel: string;
  /** Grams in the usual portion (qty × grams per unit), or null if unknown. */
  defaultGrams: number | null;
  energyKcalPer100g: number | null;
}

/** A unit the food can be measured in, with grams in 1 unit. */
export interface FoodUnitOption {
  unit: string;
  label: string;
  grams: number;
  isDefault: boolean;
}

/** Everything the food detail screen shows. Nutrients are per 100 g. */
export interface FoodDetail {
  id: number;
  name: string;
  nameHi: string | null;
  source: FoodSource;
  kind: 'ingredient' | 'dish';
  densityGPerMl: number;
  defaultUnit: string;
  defaultQty: number;
  energyEstimated: boolean;
  nutrients: NutrientValues;
  /** Units to pick from; the default unit first, `g` always last. */
  units: FoodUnitOption[];
}
