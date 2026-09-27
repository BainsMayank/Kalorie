/// <reference types="node" />
// INDB recipe ingredients (data/raw/recipes.xlsx): 10,271 rows, one per ingredient of each of the
// 1,014 INDB dishes. Amounts are kitchen measures (tsp, tbsp, cup, ml, g), turned into grams here.

import { readFileSync } from 'node:fs';

import * as XLSX from 'xlsx';

import { normalizeText } from '../../../src/lib/search';

export interface RawIngredient {
  recipeCode: string;
  position: number;
  name: string;
  /** IFCT code (A015) or Anuvaad's own code (T508); empty when INDB gives none (food colour). */
  code: string;
  amount: number | null;
  unit: string;
  /** What the recipe does with it, from INDB's own wording ("for frying", "for soaking"). */
  use: IngredientUse;
}

/**
 * `eaten`: part of the dish. `frying`: oil for deep frying — most of it stays in the pan.
 * `discarded`: water that never reaches the plate (boiling an egg, the steamer's water).
 * Soaking water is not discarded: sago soaks it up and dates are ground with it.
 */
export type IngredientUse = 'eaten' | 'frying' | 'discarded';

/**
 * Reads INDB's original amount and name ("for deep frying", "Oil (for frying)",
 * "enough to immerse egg", "Water for steaming"). The converted amount ("2 C") loses this.
 */
export function ingredientUse(amountOrg: string, nameOrg: string): IngredientUse {
  const text = `${amountOrg} ${nameOrg}`.toLowerCase();
  if (/\bfr(y|ying|yng)\b/.test(text)) return 'frying';
  if (/\b(immerse|steaming)\b/.test(text)) return 'discarded';
  return 'eaten';
}

/** Millilitres in one recipe measure. The cup matches the app's cup (SPEC §4.1: 240 ml). */
export const RECIPE_UNIT_ML: Record<string, number> = { ml: 1, tsp: 5, tbsp: 15, C: 240 };

/** Grams for measures that aren't volumes. Herbs by the sprig, a pinch of salt, a few drops. */
export const RECIPE_UNIT_GRAMS: Record<string, number> = {
  g: 1,
  sprig: 1.5,
  nos: 1, // only used for tiny items here (rose petals, reetha)
  pinch: 0.3,
  drops: 0.05,
  sheet: 0.5, // silver foil
};

/** Grams of an ingredient. `null` when the amount or unit is missing or unknown. */
export function recipeGrams(
  amount: number | null,
  unit: string,
  densityGPerMl: number,
): number | null {
  if (amount === null || !(amount >= 0)) return null;
  if (unit in RECIPE_UNIT_ML) return amount * RECIPE_UNIT_ML[unit] * densityGPerMl;
  if (unit in RECIPE_UNIT_GRAMS) return amount * RECIPE_UNIT_GRAMS[unit];
  return null;
}

// First letter of IFCT and Anuvaad codes is the IFCT food group, which gives a category
// (and so a density) for ingredients that aren't linked to a food.
const CODE_GROUP_CATEGORY: Record<string, string> = {
  A: 'cereal',
  B: 'pulse',
  C: 'leafy_veg',
  D: 'vegetable',
  E: 'fruit',
  F: 'root_tuber',
  G: 'spice',
  H: 'nuts_seeds',
  I: 'sugar',
  J: 'mushroom',
  K: 'misc',
  L: 'dairy',
  M: 'egg',
  N: 'poultry',
  O: 'meat',
  P: 'fish',
  Q: 'fish',
  R: 'fish',
  S: 'fish',
  T: 'oil_fat',
  U: 'baked',
  V: 'beverage',
  W: 'sweet',
  X: 'condiment',
};

export function categoryFromCode(code: string): string {
  return CODE_GROUP_CATEGORY[code.charAt(0)] ?? 'misc';
}

const FAT_WORDS = /\b(oil|oils|ghee|butter|vanaspati|margarine|dalda)\b/;
const NOT_FAT_WORDS =
  /\b(peanut butter|butter ?milk|cocoa butter|butter beans|almond butter|oil seeds?)\b/;

/**
 * Is this ingredient a cooking fat (oil, ghee, butter, vanaspati, margarine)? These are what the
 * Less / Normal / More oil control scales (SPEC §5.5).
 */
export function isFatIngredient(name: string, category: string): boolean {
  const text = normalizeText(name);
  if (NOT_FAT_WORDS.test(text)) return false;
  return category === 'oil_fat' || FAT_WORDS.test(text);
}

/**
 * Energy check for one dish: kcal of its ingredients ÷ (dish kcal per 100 g × recipe weight / 100).
 * INDB's per-100 g values are the recipe's totals divided by the RAW weight of all ingredients
 * (no allowance for water boiling off), so this should be close to 1 — which also confirms that
 * our kitchen-measure conversions (cup 240 ml, tsp 5 ml, densities) match INDB's.
 *
 * Only worked out when ingredients with known energy make up ≥ 95% of the non-water weight;
 * otherwise `null`.
 */
export function energyCheckRatio(input: {
  knownKcal: number;
  knownGrams: number;
  /** Grams of every ingredient except water. */
  solidGrams: number;
  rawGrams: number;
  dishKcalPer100: number | null;
}): number | null {
  const { knownKcal, knownGrams, solidGrams, rawGrams, dishKcalPer100 } = input;
  if (!dishKcalPer100 || dishKcalPer100 <= 0 || rawGrams <= 0) return null;
  if (solidGrams > 0 && knownGrams / solidGrams < 0.95) return null;
  return knownKcal / ((dishKcalPer100 * rawGrams) / 100);
}

/** Reads recipes.xlsx, grouped by INDB dish code, ingredients in file order. */
export function readIndbRecipes(path: string): Map<string, RawIngredient[]> {
  const workbook = XLSX.read(readFileSync(path));
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[workbook.SheetNames[0]],
    { defval: null },
  );
  const recipes = new Map<string, RawIngredient[]>();
  for (const r of rows) {
    const recipeCode = String(r.recipe_code ?? '').trim();
    if (!recipeCode) continue;
    const list = recipes.get(recipeCode) ?? [];
    const amount = Number(r.amount);
    list.push({
      recipeCode,
      position: list.length + 1,
      name: String(r.food_name ?? r.ingredient_name_org ?? '').trim(),
      code: String(r.food_code ?? '').trim(),
      amount: r.amount === null || r.amount === '' || !Number.isFinite(amount) ? null : amount,
      unit: String(r.unit ?? '').trim(),
      use: ingredientUse(String(r.amount_org ?? ''), String(r.ingredient_name_org ?? '')),
    });
    recipes.set(recipeCode, list);
  }
  return recipes;
}
