import type { NutrientKey, NutrientValues } from '../../src/lib/nutrients';

export type Source = 'indb' | 'ifct' | 'usda_fnd' | 'usda_sr';
export type Kind = 'ingredient' | 'dish';
export type Diet = 'veg' | 'egg' | 'nonveg';
export type SynonymKind = 'hindi' | 'spelling' | 'regional' | 'english';

/** Source priority for duplicates and search ranking (SPEC §4.1): lower wins. */
export const SOURCE_RANK: Record<Source, number> = { indb: 1, ifct: 2, usda_fnd: 3, usda_sr: 3 };

/** A unit as it will be written to `food_units`. `label` has no number: "medium roti". */
export interface UnitRow {
  unit: string;
  grams: number;
  label: string;
}

/** One food after reading its source, before units, synonyms and ids are added. */
export interface FoodRecord {
  source: Source;
  sourceCode: string;
  /** Display name, English. */
  name: string;
  /** Roman-letter Hindi name, if the source has one ("Garam Chai", "Bhindi"). */
  nameHi: string | null;
  /** Search terms that come with the source data (IFCT regional names, INDB bracket names). */
  sourceTerms: { term: string; kind: SynonymKind }[];
  /** The category name used by the source itself (IFCT group, USDA category). Empty for INDB. */
  sourceCategory: string;
  kind: Kind;
  category: string;
  diet: Diet | null;
  nutrients: NutrientValues;
  energyEstimated: boolean;
  /** What the source said for each nutrient, for the spot-check report ("enerc 1491 kJ"). */
  trace: Partial<Record<NutrientKey, string>>;
  /** INDB's serving, already converted to grams. */
  serving: UnitRow | null;
  /** USDA household portions (cup, tbsp, slice, piece…). */
  portions: UnitRow[];
}

/** Makes the "<source>:<code>" reference used in the curated CSV files. */
export function refOf(food: Pick<FoodRecord, 'source' | 'sourceCode'>): string {
  return `${food.source}:${food.sourceCode}`;
}
