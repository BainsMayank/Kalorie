/// <reference types="node" />
// INDB (Indian Nutrient Databank, Anuvaad 2024.11): 1,014 Indian dishes, nutrients per 100 g.

import { readFileSync } from 'node:fs';

import * as XLSX from 'xlsx';

import {
  type NutrientKey,
  emptyNutrients,
  estimateEnergyKcal,
  scale,
  sumKnown,
  vitaminAUg,
} from '../../../src/lib/nutrients';
import { servingGrams } from '../../../src/lib/units';
import { dietFromName, indbCategory, splitAlternatives, splitIndbName } from '../classify';
import type { FoodRecord, UnitRow } from '../types';

type Row = Record<string, unknown>;

function num(row: Row, column: string): number | null {
  const v = row[column];
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Servings that are containers, not countable pieces. Bowls and plates keep their own unit so
// the portion sheet can show "1 bowl" next to the standard 150 ml katori.
const BOWLS = new Set(['bowl', 'small bowl', 'soup bowl', 'curry bowl']);
const PLATES = new Set(['plate', 'small plate', 'shallow dish']);
const CONTAINERS = new Set([
  'cup',
  'tea cup',
  'glass',
  'tall glass',
  'juice glass',
  'tall stemmed glass',
  'sundae glass',
  'ice cream cup',
  'ice-cream cup',
  'souffle cup',
  'souffle dish',
  'dish',
  'casserole dish',
  'small casserole dish',
  'small mould',
  'portion',
  'basket',
]);
// Serving names that don't describe a real portion (a whole jar of pickle, "ml", "gm").
const DROPPED = new Set(['ml', 'gm', 'jar', 'glass jar', 'half-pints', 'box']);

/** Serving weights outside this range are whole-recipe amounts or data errors. */
export const SERVING_GRAMS_MIN = 5;
export const SERVING_GRAMS_MAX = 600;
/** More kcal than this in one piece or slice means INDB's piece count for the recipe is off. */
export const PIECE_KCAL_MAX = 450;
/** …and in one bowl, plate or glass. */
export const SERVING_KCAL_MAX = 700;
/** Largest believable cup or glass, in grams (INDB calls a 460 ml mug of coffee "1 tea cup"). */
const CONTAINER_GRAMS_MAX: Record<string, number> = {
  'tea cup': 250,
  cup: 300,
  glass: 350,
  'juice glass': 300,
  'tall glass': 450,
  'tall stemmed glass': 450,
};

/** Turns INDB's serving name into a unit key: "tall glass" → serving, "parantha" → piece. */
export function indbServingUnit(text: string): { unit: string; label: string } | null {
  const label = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!label || DROPPED.has(label)) return null;
  if (label === 'tablespoon') return { unit: 'tbsp', label: 'tbsp' };
  if (label === 'teaspoon') return { unit: 'tsp', label: 'tsp' };
  if (label === 'slice' || label === 'large slice') return { unit: 'slice', label };
  if (BOWLS.has(label)) return { unit: 'bowl', label };
  if (PLATES.has(label)) return { unit: 'plate', label };
  if (CONTAINERS.has(label)) return { unit: 'serving', label };
  return { unit: 'piece', label };
}

/**
 * The INDB serving as a unit row, as INDB gives it, or `null` if it's missing. Check it with
 * `believableServing` after the recipe fixes (`fixedIndbServing`).
 */
export function indbServing(row: Row): UnitRow | null {
  const unit = indbServingUnit(String(row.servings_unit ?? ''));
  if (!unit) return null;
  // Any nutrient given both ways gives the weight; kcal first, then the macros.
  const pairs: [string, string][] = [
    ['unit_serving_energy_kcal', 'energy_kcal'],
    ['unit_serving_carb_g', 'carb_g'],
    ['unit_serving_protein_g', 'protein_g'],
    ['unit_serving_fat_g', 'fat_g'],
  ];
  for (const [perServing, per100] of pairs) {
    const grams = servingGrams(num(row, perServing), num(row, per100));
    if (grams === null) continue;
    return { ...unit, grams: Math.round(grams * 10) / 10 };
  }
  return null;
}

/**
 * Is this a believable single serving? Not if it's outside 5–600 g, a piece over 450 kcal, a
 * bowl or glass over 700 kcal, or a cup or glass bigger than cups and glasses are.
 */
export function believableServing(serving: UnitRow, kcalPer100: number | null): boolean {
  const { grams, unit, label } = serving;
  if (grams < SERVING_GRAMS_MIN || grams > SERVING_GRAMS_MAX) return false;
  if (grams > (CONTAINER_GRAMS_MAX[label] ?? Infinity)) return false;
  if (kcalPer100 === null) return true;
  const kcal = (grams * kcalPer100) / 100;
  const isPiece = unit === 'piece' || unit === 'slice';
  return kcal <= (isPiece ? PIECE_KCAL_MAX : SERVING_KCAL_MAX);
}

/**
 * The INDB serving after the recipe fixes (SPEC §3). INDB's serving is the whole recipe divided
 * into pieces, so it shrinks with the recipe: `scale` = fixed recipe weight ÷ listed weight.
 * `pieces` (from indb_servings.csv) replaces INDB's count: grams = recipe weight ÷ pieces.
 * Returns the serving unchanged when nothing applies, or `null` if it isn't believable.
 */
export function fixedIndbServing(
  serving: UnitRow | null,
  kcalPer100: number | null,
  scale: number,
  pieces?: { pieces: number; label: string; yieldG: number },
): UnitRow | null {
  let fixed = serving;
  if (pieces) {
    fixed = {
      unit: 'piece',
      label: pieces.label,
      grams: Math.round((pieces.yieldG / pieces.pieces) * 10) / 10,
    };
  } else if (serving && scale !== 1) {
    fixed = { ...serving, grams: Math.round(serving.grams * scale * 10) / 10 };
  }
  return fixed && believableServing(fixed, kcalPer100) ? fixed : null;
}

// INDB column → our column, with a factor (fatty acids are in mg, we store g).
const DIRECT: [NutrientKey, string, number][] = [
  ['protein_g', 'protein_g', 1],
  ['carb_g', 'carb_g', 1],
  ['fat_g', 'fat_g', 1],
  ['fibre_g', 'fibre_g', 1],
  ['sugar_g', 'freesugar_g', 1],
  ['sat_fat_g', 'sfa_mg', 1 / 1000],
  ['mufa_g', 'mufa_mg', 1 / 1000],
  ['pufa_g', 'pufa_mg', 1 / 1000],
  ['cholesterol_mg', 'cholesterol_mg', 1],
  ['sodium_mg', 'sodium_mg', 1],
  ['potassium_mg', 'potassium_mg', 1],
  ['calcium_mg', 'calcium_mg', 1],
  ['iron_mg', 'iron_mg', 1],
  ['magnesium_mg', 'magnesium_mg', 1],
  ['phosphorus_mg', 'phosphorus_mg', 1],
  ['zinc_mg', 'zinc_mg', 1],
  ['copper_mg', 'copper_mg', 1],
  ['manganese_mg', 'manganese_mg', 1],
  ['selenium_ug', 'selenium_ug', 1],
  ['thiamine_mg', 'vitb1_mg', 1],
  ['riboflavin_mg', 'vitb2_mg', 1],
  ['niacin_mg', 'vitb3_mg', 1],
  ['pantothenic_mg', 'vitb5_mg', 1],
  ['vit_b6_mg', 'vitb6_mg', 1],
  ['biotin_ug', 'vitb7_ug', 1],
  ['folate_ug', 'folate_ug', 1],
  ['vit_c_mg', 'vitc_mg', 1],
  ['vit_e_mg', 'vite_mg', 1],
];
// Not in INDB at all: trans fat, iodine, vitamin B12 — they stay null (unknown).

/** Converts one INDB spreadsheet row. */
export function indbFood(row: Row): FoodRecord {
  const raw = String(row.food_name).trim();
  const { name, nameHi } = splitIndbName(raw);
  const nutrients = emptyNutrients();
  const trace: FoodRecord['trace'] = {};
  const show = (v: number | null) => (v === null ? '—' : String(Math.round(v * 1000) / 1000));

  for (const [key, column, factor] of DIRECT) {
    nutrients[key] = scale(num(row, column), factor);
    trace[key] = `${column} ${show(num(row, column))}${factor === 1 ? '' : ' ÷ 1000'}`;
  }

  // INDB's vita_ug is retinol only (a spinach paratha has 0), so carotenoids are added with
  // ICMR-NIN's general factor of 6:1 (p. 10).
  nutrients.vit_a_ug = vitaminAUg({
    retinolUg: num(row, 'vita_ug'),
    betaCaroteneUg: num(row, 'carotenoids_ug'),
  });
  trace.vit_a_ug = `vita_ug ${show(num(row, 'vita_ug'))} + carotenoids_ug ${show(num(row, 'carotenoids_ug'))} ÷ 6`;
  // INDB's vitamin D is added up from IFCT's ingredient values, including IFCT's vitamin D in
  // plant foods (soya bean 70 µg, pomegranate 109 µg per 100 g), which isn't believable and is
  // left out of IFCT's own rows (ifct.ts). So a dish's vitamin D is unknown.
  nutrients.vit_d_ug = null;
  trace.vit_d_ug = `vitd2 ${show(num(row, 'vitd2_ug'))} + vitd3 ${show(num(row, 'vitd3_ug'))} → unknown (built from IFCT plant values)`;
  nutrients.vit_k_ug = sumKnown(num(row, 'vitk1_ug'), num(row, 'vitk2_ug'));
  trace.vit_k_ug = `vitk1 ${show(num(row, 'vitk1_ug'))} + vitk2 ${show(num(row, 'vitk2_ug'))}`;

  let energyEstimated = false;
  nutrients.energy_kcal = num(row, 'energy_kcal');
  trace.energy_kcal = `energy_kcal ${show(nutrients.energy_kcal)}`;
  if (nutrients.energy_kcal === null) {
    nutrients.energy_kcal = estimateEnergyKcal(
      nutrients.protein_g,
      nutrients.carb_g,
      nutrients.fat_g,
    );
    energyEstimated = nutrients.energy_kcal !== null;
    trace.energy_kcal = 'estimated 4P + 4C + 9F';
  }

  const sourceTerms: FoodRecord['sourceTerms'] = [];
  if (nameHi) {
    sourceTerms.push({ term: nameHi, kind: 'hindi' });
    for (const alt of splitAlternatives(nameHi)) sourceTerms.push({ term: alt, kind: 'hindi' });
  }

  return {
    source: 'indb',
    sourceCode: String(row.food_code),
    name,
    nameHi,
    sourceTerms,
    sourceCategory: '',
    kind: 'dish',
    category: indbCategory(name),
    diet: dietFromName(raw),
    nutrients,
    energyEstimated,
    trace,
    serving: indbServing(row),
    portions: [],
  };
}

export function readIndb(path: string): FoodRecord[] {
  const workbook = XLSX.read(readFileSync(path));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  return rows.filter((r) => r.food_code && r.food_name).map(indbFood);
}
