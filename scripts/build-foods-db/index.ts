/// <reference types="node" />
// Builds assets/db/foods.db from data/raw/ (INDB, USDA), the @ifct2017/compositions package
// (IFCT 2017) and data/curated/. Run with: npm run build:foods

import { statSync } from 'node:fs';
import { join } from 'node:path';

import { NUTRIENT_KEYS, completenessFlags, roundTo } from '../../src/lib/nutrients';
import { normalizeText } from '../../src/lib/search';
import {
  loadCategoryOverrides,
  loadCategoryUnits,
  loadDensityRules,
  loadDuplicateDecisions,
  loadIngredientMap,
  loadRda,
  loadSearchPins,
  loadServingOverrides,
  loadSynonymGroups,
  loadUnitRules,
} from './curated';
import { dedupe } from './dedupe';
import { buildFoodUnits } from './food-units';
import { stableFoodId } from './ids';
import { attachRecipes } from './recipes';
import { type ServingSummary, printReport } from './report';
import { DB_VERSION } from './schema';
import { readIfct } from './sources/ifct';
import { fixedIndbServing, readIndb } from './sources/indb';
import { readIndbRecipes } from './sources/indb-recipes';
import { readUsda } from './sources/usda';
import { searchText, synonymsFor } from './synonyms';
import { type FoodRecord, SOURCE_RANK, refOf } from './types';
import { type FoodRow, writeFoodsDb } from './write';

const ROOT = join(__dirname, '..', '..');
const RAW = join(ROOT, 'data', 'raw');
const OUTPUT = join(ROOT, 'assets', 'db', 'foods.db');

// Source files and the versions recorded in the `meta` table.
const INPUTS = {
  indb: { path: join(RAW, 'Anuvaad_INDB_2024.11.xlsx'), version: 'Anuvaad INDB 2024.11' },
  indbRecipes: { path: join(RAW, 'recipes.xlsx'), version: 'Anuvaad INDB 2024.11 recipes' },
  ifct: {
    path: join(ROOT, 'node_modules', '@ifct2017', 'compositions', 'index.csv'),
    version: 'IFCT 2017 (@ifct2017/compositions 2.0.9)',
  },
  usdaFnd: {
    path: join(RAW, 'FoodData_Central_foundation_food_csv_2026-04-30'),
    version: 'FDC Foundation 2026-04-30',
  },
  usdaSr: {
    path: join(RAW, 'FoodData_Central_sr_legacy_food_csv_2018-04'),
    version: 'FDC SR Legacy 2018-04',
  },
};

function main(): void {
  const categoryUnits = loadCategoryUnits();
  const unitRules = loadUnitRules(categoryUnits);
  const densityRules = loadDensityRules(categoryUnits);
  const synonymGroups = loadSynonymGroups();
  const overrides = loadCategoryOverrides(categoryUnits);

  console.log('Reading INDB…');
  const indb = readIndb(INPUTS.indb.path);
  const indbRecipes = readIndbRecipes(INPUTS.indbRecipes.path);
  console.log('Reading IFCT…');
  const ifct = readIfct(INPUTS.ifct.path);
  console.log('Reading USDA Foundation…');
  const fnd = readUsda(INPUTS.usdaFnd.path, 'usda_fnd');
  console.log('Reading USDA SR Legacy (the big one)…');
  const sr = readUsda(INPUTS.usdaSr.path, 'usda_sr');

  const all: FoodRecord[] = [...indb, ...ifct.foods, ...fnd.foods, ...sr.foods];
  for (const food of all) {
    const override = overrides.get(refOf(food));
    if (override) food.category = override;
    if (!categoryUnits.has(food.category)) {
      throw new Error(
        `${refOf(food)} has category "${food.category}", which category_units.csv doesn't define`,
      );
    }
  }

  const deduped = dedupe(all, loadDuplicateDecisions());
  const unitsFor = (food: FoodRecord) =>
    buildFoodUnits(
      food,
      normalizeText(food.name),
      categoryUnits.get(food.category),
      unitRules,
      densityRules,
    );

  const ids = new Map<number, string>();
  const rows: FoodRow[] = deduped.kept.map((food) => {
    const ref = refOf(food);
    const id = stableFoodId(ref);
    if (ids.has(id)) throw new Error(`id collision between ${ids.get(id)} and ${ref}`);
    ids.set(id, ref);

    const normalizedName = normalizeText(food.name);
    const units = unitsFor(food);
    const synonyms = synonymsFor(food, normalizedName, synonymGroups);
    const nutrients = { ...food.nutrients };
    for (const k of NUTRIENT_KEYS) nutrients[k] = roundTo(nutrients[k], 3);

    return {
      id,
      source: food.source,
      sourceCode: food.sourceCode,
      name: food.name,
      nameHi: food.nameHi,
      category: food.category,
      kind: food.kind,
      diet: food.diet,
      // Every INDB dish now has a recipe, so the oil control uses its fat ingredients
      // (SPEC §5.5); the no-recipe rule is only for foods users create.
      cookedWithFat: false,
      density: units.density,
      defaultUnit: units.defaultUnit,
      defaultQty: units.defaultQty,
      energyEstimated: food.energyEstimated,
      searchRank: SOURCE_RANK[food.source],
      ...completenessFlags(nutrients),
      nutrients,
      units: units.units,
      synonyms,
      searchText: searchText(normalizedName, synonyms),
      yieldG: null,
      recipe: [],
    };
  });

  const rowByRef = new Map(rows.map((r) => [`${r.source}:${r.sourceCode}`, r]));
  const keptRefOf = new Map(deduped.dropped.map((d) => [refOf(d.dropped), d.keptRef]));
  const recipeStats = attachRecipes(
    rows,
    indbRecipes,
    loadIngredientMap(),
    (ref) => rowByRef.get(ref) ?? rowByRef.get(keptRefOf.get(ref) ?? ''),
    densityRules,
    categoryUnits,
  );

  const servings = fixIndbServings(rows, deduped.kept, recipeStats.servingScale, unitsFor);

  const pins = loadSearchPins().flatMap((pin) => {
    const row = rowByRef.get(pin.ref) ?? rowByRef.get(keptRefOf.get(pin.ref) ?? '');
    if (!row) throw new Error(`data/curated/search_pins.csv: no food ${pin.ref} (${pin.name})`);
    if (row.name !== pin.name) {
      throw new Error(
        `data/curated/search_pins.csv: ${pin.ref} is "${row.name}", not "${pin.name}"`,
      );
    }
    return pin.terms.map((term) => ({ term, foodId: row.id }));
  });

  writeFoodsDb(OUTPUT, rows, loadRda(), pins, {
    db_version: String(DB_VERSION),
    built_at: new Date().toISOString(),
    indb_version: INPUTS.indb.version,
    indb_recipes_version: INPUTS.indbRecipes.version,
    ifct_version: INPUTS.ifct.version,
    usda_fnd_version: INPUTS.usdaFnd.version,
    usda_sr_version: INPUTS.usdaSr.version,
    food_count: String(rows.length),
  });

  printReport({
    read: [
      { source: 'indb', rows: indb.length, notes: [] },
      {
        source: 'ifct',
        rows: ifct.foods.length,
        notes: [
          `${ifct.skippedVarieties} numbered varieties skipped (e.g. Brinjal-1…21; the "all varieties" rows are kept)`,
        ],
      },
      {
        source: 'usda_fnd',
        rows: fnd.foods.length,
        notes: [
          `${fnd.excludedByCategory} left out by category`,
          `${fnd.droppedNoEnergy.length} left out: no energy and not enough macros to estimate it`,
        ],
      },
      {
        source: 'usda_sr',
        rows: sr.foods.length,
        notes: [
          `${sr.excludedByCategory} left out by category (baby foods, restaurant, branded…)`,
          `${sr.droppedNoEnergy.length} left out: no energy`,
        ],
      },
    ],
    dedupe: deduped,
    recipes: recipeStats,
    servings,
    foods: rows,
    records: new Map(all.map((f) => [refOf(f), f])),
    synonymTermsCurated: synonymGroups.reduce((n, g) => n + g.terms.length, 0),
    fileSizeBytes: statSync(OUTPUT).size,
    outputPath: 'assets/db/foods.db',
  });
}

/**
 * INDB servings after the recipe fixes: resized with the recipe, piece counts from
 * indb_servings.csv, and dropped when still not believable (SPEC §3). Rebuilds the units of
 * every food whose serving changed.
 */
function fixIndbServings(
  rows: FoodRow[],
  records: FoodRecord[],
  servingScale: Map<number, number>,
  unitsFor: (food: FoodRecord) => ReturnType<typeof buildFoodUnits>,
): ServingSummary {
  const overrides = loadServingOverrides();
  const recordByRef = new Map(records.map((f) => [refOf(f), f]));
  const summary: ServingSummary = { resized: 0, overridden: 0, dropped: [] };
  const used = new Set<string>();

  for (const row of rows) {
    if (row.source !== 'indb') continue;
    const ref = `indb:${row.sourceCode}`;
    const record = recordByRef.get(ref);
    if (!record) continue;
    const override = overrides.get(ref);
    if (override && override.name !== row.name) {
      throw new Error(
        `data/curated/indb_servings.csv: ${ref} is "${row.name}", not "${override.name}"`,
      );
    }
    const kcal = row.nutrients.energy_kcal;
    const scale = servingScale.get(row.id) ?? 1;
    const pieces = override && row.yieldG ? { ...override, yieldG: row.yieldG } : undefined;
    const serving = fixedIndbServing(record.serving, kcal, scale, pieces);
    if (override) {
      if (!serving) {
        throw new Error(`data/curated/indb_servings.csv: ${ref} gives an unbelievable piece`);
      }
      used.add(ref);
      summary.overridden++;
    } else if (serving && serving !== record.serving) summary.resized++;
    if (record.serving && !serving) {
      const g = record.serving.grams;
      summary.dropped.push(
        `${row.name} (1 ${record.serving.label} = ${Math.round(g * scale)} g, ` +
          `${Math.round(((g * scale) / 100) * (kcal ?? 0))} kcal)`,
      );
    }
    if (serving === record.serving) continue;
    const units = unitsFor({ ...record, serving });
    row.units = units.units;
    row.defaultUnit = units.defaultUnit;
    row.defaultQty = units.defaultQty;
  }

  for (const ref of overrides.keys()) {
    if (!used.has(ref)) throw new Error(`data/curated/indb_servings.csv: no INDB food ${ref}`);
  }
  return summary;
}

main();
