/// <reference types="node" />
// Writes foods.db with Node's built-in SQLite (node:sqlite), which includes FTS5.

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  NUTRIENT_KEYS,
  type CompletenessFlags,
  type NutrientValues,
} from '../../src/lib/nutrients';
import { UNIT_DEFAULTS } from '../../src/lib/units';
import type { RdaRow } from './curated';
import type { RecipeRow } from './recipes';
import { SCHEMA_SQL } from './schema';
import type { Synonym } from './synonyms';
import type { Diet, Kind, Source, UnitRow } from './types';

/** A food exactly as it goes into the `foods` table, with its units and synonyms. */
export interface FoodRow extends CompletenessFlags {
  id: number;
  source: Source;
  sourceCode: string;
  name: string;
  nameHi: string | null;
  category: string;
  kind: Kind;
  diet: Diet | null;
  cookedWithFat: boolean;
  density: number;
  defaultUnit: string;
  defaultQty: number;
  energyEstimated: boolean;
  searchRank: number;
  nutrients: NutrientValues;
  units: (UnitRow & { isDefault: boolean })[];
  synonyms: Synonym[];
  searchText: string;
  /**
   * Weight of the whole recipe that the per-100 g values refer to (INDB dishes: the raw
   * ingredients, minus frying oil left in the pan and discarded water), or null.
   */
  yieldG: number | null;
  /** INDB recipe ingredients, or empty. */
  recipe: RecipeRow[];
}

export function writeFoodsDb(
  path: string,
  foods: readonly FoodRow[],
  rda: readonly RdaRow[],
  pins: readonly { term: string; foodId: number }[],
  meta: Record<string, string>,
): void {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) rmSync(path);
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;');
  db.exec(SCHEMA_SQL);

  const foodColumns = [
    'id',
    'source',
    'source_code',
    'name',
    'name_hi',
    'category',
    'kind',
    'diet',
    'cooked_with_fat',
    'density_g_per_ml',
    'default_unit',
    'default_qty',
    'yield_g',
    'energy_estimated',
    'search_rank',
    'complete_macro',
    'complete_other',
    'complete_mineral',
    'complete_vitamin',
    ...NUTRIENT_KEYS,
  ];
  const insertFood = db.prepare(
    `INSERT INTO foods (${foodColumns.join(', ')}) VALUES (${foodColumns.map(() => '?').join(', ')})`,
  );
  const insertUnit = db.prepare(
    'INSERT INTO food_units (food_id, unit, label, grams, is_default) VALUES (?, ?, ?, ?, ?)',
  );
  const insertSynonym = db.prepare(
    'INSERT INTO food_synonyms (food_id, term, kind) VALUES (?, ?, ?)',
  );
  const insertFts = db.prepare('INSERT INTO foods_fts (food_id, text) VALUES (?, ?)');
  const recipeColumns = [
    'recipe_food_id',
    'position',
    'ingredient_food_id',
    'ingredient_name',
    'grams',
    'is_fat',
    ...NUTRIENT_KEYS,
  ];
  const insertRecipe = db.prepare(
    `INSERT INTO recipe_ingredients (${recipeColumns.join(', ')}) VALUES (${recipeColumns.map(() => '?').join(', ')})`,
  );
  const b = (v: boolean) => (v ? 1 : 0);

  db.exec('BEGIN');
  for (const f of foods) {
    insertFood.run(
      f.id,
      f.source,
      f.sourceCode,
      f.name,
      f.nameHi,
      f.category,
      f.kind,
      f.diet,
      b(f.cookedWithFat),
      f.density,
      f.defaultUnit,
      f.defaultQty,
      f.yieldG,
      b(f.energyEstimated),
      f.searchRank,
      f.complete_macro,
      f.complete_other,
      f.complete_mineral,
      f.complete_vitamin,
      ...NUTRIENT_KEYS.map((k) => f.nutrients[k]),
    );
    for (const u of f.units) insertUnit.run(f.id, u.unit, u.label, u.grams, b(u.isDefault));
    for (const s of f.synonyms) insertSynonym.run(f.id, s.term, s.kind);
    insertFts.run(f.id, f.searchText);
    for (const r of f.recipe) {
      insertRecipe.run(
        f.id,
        r.position,
        r.ingredientFoodId,
        r.name,
        r.grams,
        b(r.isFat),
        ...NUTRIENT_KEYS.map((k) => r.nutrients[k]),
      );
    }
  }

  const insertUnitDefault = db.prepare(
    'INSERT INTO unit_defaults (unit, ml, grams, label) VALUES (?, ?, ?, ?)',
  );
  for (const u of UNIT_DEFAULTS) insertUnitDefault.run(u.unit, u.ml, u.grams, u.label);

  const insertRda = db.prepare(
    'INSERT INTO rda_reference (nutrient, sex, rda, tul, per_1000_kcal, unit) VALUES (?, ?, ?, ?, ?, ?)',
  );
  for (const r of rda) insertRda.run(r.nutrient, r.sex, r.rda, r.tul, r.per1000Kcal, r.unit);

  const insertPin = db.prepare('INSERT INTO search_pins (term, food_id) VALUES (?, ?)');
  for (const p of pins) insertPin.run(p.term, p.foodId);

  const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(meta)) insertMeta.run(key, value);
  db.exec('COMMIT');

  // Merge the search index into one segment and pack the file as small as possible.
  db.exec("INSERT INTO foods_fts(foods_fts) VALUES ('optimize');");
  db.exec('PRAGMA journal_mode = DELETE; VACUUM;');
  db.close();
}
