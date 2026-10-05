// Types for reading foods.db (SPEC §4.1).

import type { NutrientValues } from '@/lib/nutrients';
import type { OilStep } from '@/lib/oil';
import type { FoodSourceKind } from '@/lib/suggestions';

export type SqlValue = string | number | null;

/**
 * The one database method the food queries need. expo-sqlite's database has it, and tests
 * wrap Node's built-in SQLite in the same shape, so the queries run against the real foods.db.
 */
export interface ReadDb {
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
}

export type FoodSource = 'indb' | 'ifct' | 'usda_fnd' | 'usda_sr';

/** Kinds of food kept in user.db (`custom_foods.kind`). */
export type CustomFoodKind = 'custom' | 'product' | 'recipe';

/** Where a food's data comes from, as its tag shows it: a foods.db source or a user.db kind. */
export type FoodTag = FoodSource | CustomFoodKind;

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
  /** How well it matched the query (`MatchTier`, + 10 if found only by the typo pass). */
  tier: number;
  /** Times the person logged it in the last 30 days. */
  uses: number;
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
  /** foods.db or user.db, and the id there (foods.id as text, or custom_foods.id). */
  foodSource: FoodSourceKind;
  foodId: string;
  name: string;
  nameHi: string | null;
  /** Products only. */
  brand: string | null;
  barcode: string | null;
  /** A photo of the product's label, if one was taken. */
  labelPhotoUri: string | null;
  /** Products: `found` = from Open Food Facts, `user_added` = typed in from the label. */
  offStatus: 'found' | 'user_added' | 'contributed' | null;
  source: FoodTag;
  densityGPerMl: number;
  defaultUnit: string;
  defaultQty: number;
  energyEstimated: boolean;
  nutrients: NutrientValues;
  /** What Less / More oil changes per 100 g (SPEC §5.5); `null` = no oil control. */
  oilStep: OilStep | null;
  /** Units to pick from; the default unit first, `g` always last. */
  units: FoodUnitOption[];
  /** Foods in user.db only: sharing with the person's group (Stage 11c). */
  sharing?: FoodSharing;
}

/**
 * `own`: the person's own food, which they can share with their group (`sharedAt` = the version
 * the group has, null = not there yet). `group`: someone else in the group shared it.
 */
export type FoodSharing =
  | { kind: 'own'; shareWithGroup: boolean; sharedAt: number | null }
  | { kind: 'group'; addedBy: string };
