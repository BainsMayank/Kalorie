/// <reference types="node" />
// Loads the hand-kept files in data/curated/ and checks them, so a typo stops the build with a
// clear message instead of quietly producing a wrong database.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'csv-parse/sync';

import { phoneticText } from '../../src/lib/search';
import { UNIT_DEFAULTS } from '../../src/lib/units';
import { type Rule, splitList, splitPhrases } from './rules';
import type { SynonymKind } from './types';

export const CURATED_DIR = join(__dirname, '..', '..', 'data', 'curated');

/** Reads a CSV with a header row. Lines starting with # are comments. */
export function readCsv(path: string): Record<string, string>[] {
  return parse(readFileSync(path, 'utf8'), {
    columns: true,
    comment: '#',
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
}

function curated(file: string): Record<string, string>[] {
  return readCsv(join(CURATED_DIR, file));
}

function fail(file: string, message: string): never {
  throw new Error(`data/curated/${file}: ${message}`);
}

function toNumber(file: string, value: string, what: string): number {
  const n = Number(value);
  if (value === '' || !Number.isFinite(n)) fail(file, `${what} "${value}" is not a number`);
  return n;
}

// --- category_units.csv -----------------------------------------------------------------

export interface CategoryUnits {
  /** Units to try as the default, in order. */
  defaultUnits: string[];
  /** Standard measures offered (katori, glass…). */
  units: string[];
  density: number;
}

export function loadCategoryUnits(): Map<string, CategoryUnits> {
  const file = 'category_units.csv';
  const standard = new Set<string>(UNIT_DEFAULTS.map((u) => u.unit));
  const result = new Map<string, CategoryUnits>();
  for (const row of curated(file)) {
    const units = splitList(row.units);
    for (const u of units) if (!standard.has(u)) fail(file, `unknown standard unit "${u}"`);
    result.set(row.category, {
      defaultUnits: splitList(row.default_unit),
      units,
      density: toNumber(file, row.density_g_per_ml, `density for ${row.category}`),
    });
  }
  return result;
}

/** Throws if a rule file names a category that category_units.csv doesn't define. */
function checkCategories(file: string, categories: string[], known: Map<string, unknown>): void {
  for (const c of categories) if (!known.has(c)) fail(file, `unknown category "${c}"`);
}

// --- unit_weights.csv and densities.csv -------------------------------------------------

export interface UnitRule {
  rule: Rule;
  unit: string;
  /** `null` = a standard measure, grams come from ml × density. */
  grams: number | null;
  label: string;
  isDefault: boolean;
  replaceServing: boolean;
}

function ruleFrom(row: Record<string, string>): Rule {
  return {
    match: splitPhrases(row.match),
    categories: splitList(row.categories),
    exclude: splitPhrases(row.exclude),
  };
}

export function loadUnitRules(categories: Map<string, CategoryUnits>): UnitRule[] {
  const file = 'unit_weights.csv';
  const standard = new Set<string>(UNIT_DEFAULTS.map((u) => u.unit));
  return curated(file).map((row) => {
    const rule = ruleFrom(row);
    checkCategories(file, rule.categories, categories);
    const grams = row.grams === '' ? null : toNumber(file, row.grams, `grams for ${row.unit}`);
    if (grams === null && !standard.has(row.unit)) {
      fail(file, `"${row.unit}" needs grams (only standard measures can leave it empty)`);
    }
    return {
      rule,
      unit: row.unit,
      grams,
      label: row.label || row.unit,
      isDefault: row.is_default === '1',
      replaceServing: row.replace_serving === '1',
    };
  });
}

export interface DensityRule {
  rule: Rule;
  density: number;
}

export function loadDensityRules(categories: Map<string, CategoryUnits>): DensityRule[] {
  const file = 'densities.csv';
  return curated(file).map((row) => {
    const rule = ruleFrom(row);
    checkCategories(file, rule.categories, categories);
    return { rule, density: toNumber(file, row.density, 'density') };
  });
}

// --- synonyms.csv -----------------------------------------------------------------------

export interface SynonymGroup {
  group: string;
  terms: { term: string; kind: SynonymKind }[];
}

const SYNONYM_KINDS = new Set<SynonymKind>(['hindi', 'spelling', 'regional', 'english']);

export function loadSynonymGroups(): SynonymGroup[] {
  const file = 'synonyms.csv';
  const groups = new Map<string, SynonymGroup>();
  for (const row of curated(file)) {
    const kind = row.kind as SynonymKind;
    if (!SYNONYM_KINDS.has(kind)) fail(file, `unknown kind "${row.kind}" for "${row.term}"`);
    const term = row.term.toLowerCase().trim();
    if (!term) fail(file, `empty term in group "${row.group}"`);
    const group = groups.get(row.group) ?? { group: row.group, terms: [] };
    group.terms.push({ term, kind });
    groups.set(row.group, group);
  }
  return [...groups.values()];
}

// --- duplicates.csv and category_overrides.csv ------------------------------------------

export interface DuplicateDecision {
  refA: string;
  refB: string;
  action: 'drop' | 'keep_both';
}

export function loadDuplicateDecisions(): DuplicateDecision[] {
  const file = 'duplicates.csv';
  return curated(file).map((row) => {
    if (row.action !== 'drop' && row.action !== 'keep_both') {
      fail(file, `action must be drop or keep_both, got "${row.action}"`);
    }
    return { refA: row.ref_a, refB: row.ref_b, action: row.action };
  });
}

export function loadCategoryOverrides(categories: Map<string, CategoryUnits>): Map<string, string> {
  const file = 'category_overrides.csv';
  const result = new Map<string, string>();
  for (const row of curated(file)) {
    checkCategories(file, [row.category], categories);
    result.set(row.ref, row.category);
  }
  return result;
}

// --- indb_ingredients.csv ---------------------------------------------------------------

/** Anuvaad ingredient code → "<source>:<code>" of a food in foods.db, or "zero" (water). */
export function loadIngredientMap(): Map<string, string> {
  const file = 'indb_ingredients.csv';
  const result = new Map<string, string>();
  for (const row of curated(file)) {
    if (!row.code || !row.ref) fail(file, `code and ref are required (row "${row.name}")`);
    if (row.ref !== 'zero' && !/^(indb|ifct|usda_fnd|usda_sr):\S+$/.test(row.ref)) {
      fail(file, `ref "${row.ref}" should look like usda_sr:173410, ifct:T013 or zero`);
    }
    if (result.has(row.code)) fail(file, `code ${row.code} is listed twice`);
    result.set(row.code, row.ref);
  }
  return result;
}

// --- search_pins.csv --------------------------------------------------------------------

export interface SearchPin {
  /** Search terms as phonetic text (SPEC §5.1), the form the app looks them up in. */
  terms: string[];
  ref: string;
  name: string;
}

export function loadSearchPins(): SearchPin[] {
  const file = 'search_pins.csv';
  const seen = new Map<string, string>();
  return curated(file).map((row) => {
    if (!/^(indb|ifct|usda_fnd|usda_sr):\S+$/.test(row.ref)) {
      fail(file, `ref "${row.ref}" should look like indb:ASC155 or usda_fnd:2259793`);
    }
    if (!row.name) fail(file, `name is required for ${row.ref}`);
    const terms = splitList(row.terms).map((t) => phoneticText(t));
    if (terms.length === 0 || terms.some((t) => !t)) fail(file, `empty term for ${row.ref}`);
    for (const term of terms) {
      const other = seen.get(term);
      if (other && other !== row.ref) {
        fail(file, `"${term}" is pinned to both ${other} and ${row.ref}`);
      }
      seen.set(term, row.ref);
    }
    return { terms: [...new Set(terms)], ref: row.ref, name: row.name };
  });
}

// --- indb_servings.csv -------------------------------------------------------------------

export interface ServingOverride {
  name: string;
  pieces: number;
  label: string;
}

/** Pieces per INDB recipe, by ref, where INDB's own count is off. */
export function loadServingOverrides(): Map<string, ServingOverride> {
  const file = 'indb_servings.csv';
  const overrides = new Map<string, ServingOverride>();
  for (const row of curated(file)) {
    if (!/^indb:\S+$/.test(row.ref)) fail(file, `ref "${row.ref}" should look like indb:BFP392`);
    if (overrides.has(row.ref)) fail(file, `${row.ref} is listed twice`);
    if (!row.name) fail(file, `name is required for ${row.ref}`);
    if (!row.label) fail(file, `label is required for ${row.ref}`);
    const pieces = toNumber(file, row.pieces, `pieces for ${row.ref}`);
    if (!(pieces > 0)) fail(file, `pieces for ${row.ref} must be more than 0`);
    overrides.set(row.ref, { name: row.name, pieces, label: row.label });
  }
  return overrides;
}

// --- thalis.csv ---------------------------------------------------------------------------

export interface ThaliItemRow {
  ref: string;
  name: string;
  qty: number;
  unit: string;
}

export interface ThaliTemplate {
  name: string;
  region: string;
  items: ThaliItemRow[];
}

const REF = /^(indb|ifct|usda_fnd|usda_sr):\S+$/;
const REGIONS = new Set(['north', 'south', 'east', 'west', 'any']);

/** The built-in starter thalis, in file order; a thali's rows are its items in order. */
export function loadThalis(): ThaliTemplate[] {
  const file = 'thalis.csv';
  const thalis = new Map<string, ThaliTemplate>();
  for (const row of curated(file)) {
    if (!row.thali) fail(file, 'thali name is required');
    if (!REGIONS.has(row.region)) fail(file, `region "${row.region}" for ${row.thali} is unknown`);
    if (!REF.test(row.ref)) fail(file, `ref "${row.ref}" should look like indb:ASC155`);
    if (!row.name) fail(file, `name is required for ${row.ref}`);
    if (!row.unit) fail(file, `unit is required for ${row.ref} in ${row.thali}`);
    const qty = toNumber(file, row.qty, `qty for ${row.ref} in ${row.thali}`);
    if (!(qty > 0)) fail(file, `qty for ${row.ref} in ${row.thali} must be more than 0`);
    const thali = thalis.get(row.thali) ?? { name: row.thali, region: row.region, items: [] };
    if (thali.region !== row.region) fail(file, `${row.thali} has more than one region`);
    thali.items.push({ ref: row.ref, name: row.name, qty, unit: row.unit });
    thalis.set(row.thali, thali);
  }
  return [...thalis.values()];
}

// --- slot_suggestions.csv -----------------------------------------------------------------

export interface SlotStarter {
  slot: string;
  ref: string;
  name: string;
}

const SLOTS = new Set(['breakfast', 'lunch', 'snacks', 'dinner']);

/** Starter foods per meal slot, in file order. */
export function loadSlotSuggestions(): SlotStarter[] {
  const file = 'slot_suggestions.csv';
  const seen = new Set<string>();
  return curated(file).map((row) => {
    if (!SLOTS.has(row.slot))
      fail(file, `slot "${row.slot}" should be breakfast, lunch, snacks or dinner`);
    if (!REF.test(row.ref)) fail(file, `ref "${row.ref}" should look like indb:ASC155`);
    if (!row.name) fail(file, `name is required for ${row.ref}`);
    const key = `${row.slot} ${row.ref}`;
    if (seen.has(key)) fail(file, `${row.ref} is listed twice for ${row.slot}`);
    seen.add(key);
    return { slot: row.slot, ref: row.ref, name: row.name };
  });
}

// --- common_foods.csv ---------------------------------------------------------------------

export interface CommonFoodRow {
  ref: string;
  name: string;
  qty: number;
  unit: string;
  /** Only for a food whose diet foods.db doesn't know. */
  diet: 'veg' | 'egg' | 'nonveg' | null;
}

const DIETS = new Set(['veg', 'egg', 'nonveg']);

/** Everyday foods with an everyday portion, for "foods rich in …" (SPEC §2.12), in file order. */
export function loadCommonFoods(): CommonFoodRow[] {
  const file = 'common_foods.csv';
  const seen = new Set<string>();
  return curated(file).map((row) => {
    if (!REF.test(row.ref)) fail(file, `ref "${row.ref}" should look like indb:ASC155`);
    if (!row.name) fail(file, `name is required for ${row.ref}`);
    if (seen.has(row.ref)) fail(file, `${row.ref} is listed twice`);
    seen.add(row.ref);
    if (!row.unit) fail(file, `unit is required for ${row.ref}`);
    const qty = toNumber(file, row.qty, `qty for ${row.ref}`);
    if (!(qty > 0)) fail(file, `qty for ${row.ref} must be more than 0`);
    if (row.diet && !DIETS.has(row.diet))
      fail(file, `diet "${row.diet}" for ${row.ref} is unknown`);
    return {
      ref: row.ref,
      name: row.name,
      qty,
      unit: row.unit,
      diet: (row.diet || null) as CommonFoodRow['diet'],
    };
  });
}
