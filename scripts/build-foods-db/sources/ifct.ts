/// <reference types="node" />
// IFCT 2017 (Indian Food Composition Tables, NIN Hyderabad) from @ifct2017/compositions (MIT).
// 542 raw foods. Every value in this package is in GRAMS per 100 g (energy in kJ), and a missing
// value is written as 0, so whole groups of zeros are turned back into "unknown".

import { readFileSync } from 'node:fs';

import { parse } from 'csv-parse/sync';

import {
  type NutrientKey,
  emptyNutrients,
  estimateEnergyKcal,
  kjToKcal,
  scale,
  vitaminAUg,
} from '../../../src/lib/nutrients';
import { dietFromIfctTags, ifctCategory, parseIfctLocalNames } from '../classify';
import type { FoodRecord } from '../types';

const G = 1;
const MG = 1000;
const UG = 1_000_000;

// Our column ← IFCT column × factor (grams → g / mg / µg).
const DIRECT: [NutrientKey, string, number][] = [
  ['protein_g', 'protcnt', G],
  ['carb_g', 'choavldf', G], // available carbohydrate, by difference
  ['fat_g', 'fatce', G],
  ['fibre_g', 'fibtg', G],
  ['sugar_g', 'fsugar', G], // IFCT's "free sugars" = all mono- and disaccharides (milk: lactose)
  ['sat_fat_g', 'fasat', G],
  ['mufa_g', 'fams', G],
  ['pufa_g', 'fapu', G],
  ['trans_fat_g', 'fatrn', G],
  ['cholesterol_mg', 'cholc', MG],
  ['sodium_mg', 'na', MG],
  ['potassium_mg', 'k', MG],
  ['calcium_mg', 'ca', MG],
  ['iron_mg', 'fe', MG],
  ['magnesium_mg', 'mg', MG],
  ['phosphorus_mg', 'p', MG],
  ['zinc_mg', 'zn', MG],
  ['copper_mg', 'cu', MG],
  ['manganese_mg', 'mn', MG],
  ['selenium_ug', 'se', UG],
  ['thiamine_mg', 'thia', MG],
  ['riboflavin_mg', 'ribf', MG],
  ['niacin_mg', 'nia', MG],
  ['pantothenic_mg', 'pantac', MG],
  ['vit_b6_mg', 'vitb6c', MG],
  ['biotin_ug', 'biot', UG],
  ['folate_ug', 'folsum', UG],
  ['vit_c_mg', 'vitc', MG],
  ['vit_d_ug', 'vitd', UG],
  ['vit_e_mg', 'tocpha', MG], // α-tocopherol
  ['vit_k_ug', 'vitk', UG], // K1 + K2
];
// Not in IFCT: iodine and vitamin B12 — they stay null (unknown).

// If every column of a group is 0, the food wasn't analysed for that group (e.g. the 14 oils
// have no vitamins or minerals at all), so the whole group becomes unknown.
const ANALYSIS_GROUPS: string[][] = [
  ['na', 'k', 'ca', 'fe', 'mg', 'p', 'zn', 'cu', 'mn', 'se'],
  [
    'retol',
    'cartbeq',
    'thia',
    'ribf',
    'nia',
    'pantac',
    'vitb6c',
    'biot',
    'folsum',
    'vitc',
    'vitd',
    'tocpha',
    'vitk',
  ],
  ['fasat', 'fams', 'fapu', 'fatrn'],
];

type Row = Record<string, string>;

/** Numeric value of a column, or `null` when the food wasn't analysed for its group. */
export function ifctValue(row: Row, column: string, unanalysed: Set<string>): number | null {
  if (unanalysed.has(column)) return null;
  const v = row[column];
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Columns whose whole analysis group is zero for this food. */
export function unanalysedColumns(row: Row): Set<string> {
  const result = new Set<string>();
  for (const group of ANALYSIS_GROUPS) {
    if (group.every((c) => Number(row[c] || 0) === 0)) group.forEach((c) => result.add(c));
  }
  // Oils and fats weren't analysed for cholesterol either (IFCT shows 0 even for ghee).
  if (row.grup === 'Edible Oils and Fats') result.add('cholc');
  return result;
}

/** IFCT lists some vegetables variety by variety ("Brinjal-1" … "Brinjal-21") plus an average. */
export function isNumberedVariety(name: string): boolean {
  return /-\s?\d+$/.test(name.trim());
}

export function ifctFood(row: Row): FoodRecord {
  const unanalysed = unanalysedColumns(row);
  const nutrients = emptyNutrients();
  const trace: FoodRecord['trace'] = {};
  const value = (c: string) => ifctValue(row, c, unanalysed);
  const unitName = (f: number) => (f === G ? 'g' : f === MG ? 'g × 1000' : 'g × 10⁶');

  for (const [key, column, factor] of DIRECT) {
    nutrients[key] = scale(value(column), factor);
    trace[key] =
      value(column) === null
        ? `${column} not analysed`
        : `${column} ${row[column]} ${unitName(factor)}`;
  }

  // cartbeq = β-carotene equivalents (β-carotene + half the α-carotene and β-cryptoxanthin), so
  // ÷ 6 gives exactly ICMR-NIN's 6:1 / 12:1 (p. 10).
  nutrients.vit_a_ug = vitaminAUg({
    retinolUg: scale(value('retol'), UG),
    betaCaroteneUg: scale(value('cartbeq'), UG),
  });
  trace.vit_a_ug =
    value('retol') === null
      ? 'not analysed'
      : `retol ${row.retol} + cartbeq ${row.cartbeq} ÷ 6 (g × 10⁶)`;

  let energyEstimated = false;
  const kj = value('enerc');
  if (kj !== null && kj > 0) {
    nutrients.energy_kcal = kjToKcal(kj);
    trace.energy_kcal = `enerc ${kj} kJ ÷ 4.184`;
  } else {
    // The 14 oils and fats have no energy value in IFCT.
    nutrients.energy_kcal = estimateEnergyKcal(
      nutrients.protein_g,
      nutrients.carb_g,
      nutrients.fat_g,
    );
    energyEstimated = nutrients.energy_kcal !== null;
    trace.energy_kcal = 'enerc 0 → estimated 4P + 4C + 9F';
  }

  const { hindi, regional } = parseIfctLocalNames(row.lang ?? '');
  const category = ifctCategory(row.grup, row.name);
  fixIfctSlips(nutrients, trace, category);
  return {
    source: 'ifct',
    sourceCode: row.code,
    name: row.name.trim(),
    nameHi: hindi[0] ?? null,
    sourceTerms: [
      ...hindi.map((term) => ({ term, kind: 'hindi' as const })),
      ...regional.map((term) => ({ term, kind: 'regional' as const })),
    ],
    sourceCategory: row.grup,
    kind: 'ingredient',
    category,
    diet: dietFromIfctTags(row.tags ?? '', category),
    nutrients,
    energyEstimated,
    trace,
    serving: null,
    portions: [],
  };
}

/** Where IFCT's vitamin D can be real: animal foods, and mushrooms (D2, made in sunlight). */
const VITAMIN_D_CATEGORIES = new Set(['fish', 'egg', 'meat', 'poultry', 'dairy', 'mushroom']);

/**
 * Two slips in the IFCT numbers, found by checking Stage 9's nutrient ranges (2026-09-28):
 * - Fish vitamin B6 and biotin are 1000× too big (B6 averages 131 mg per 100 g; fish has
 *   0.1–0.9 mg, and 100 mg a day is the safe upper level). Divided by 1000.
 * - Plant foods list vitamin D (curry leaves 117 µg, pomegranate 109 µg, soya bean 70 µg per
 *   100 g); plants other than mushrooms have next to none. Left as unknown.
 */
export function fixIfctSlips(
  nutrients: FoodRecord['nutrients'],
  trace: FoodRecord['trace'],
  category: string,
): void {
  if (category === 'fish') {
    for (const key of ['vit_b6_mg', 'biotin_ug'] as const) {
      nutrients[key] = scale(nutrients[key], 1 / 1000);
      trace[key] = `${trace[key]} ÷ 1000 (IFCT fish slip)`;
    }
  }
  if (!VITAMIN_D_CATEGORIES.has(category) && nutrients.vit_d_ug !== null) {
    trace.vit_d_ug = `${trace.vit_d_ug} → unknown (plant food)`;
    nutrients.vit_d_ug = null;
  }
}

/** Reads the package CSV. Its header cells look like "Food Code; code" — we keep the short code. */
export function readIfct(path: string): { foods: FoodRecord[]; skippedVarieties: number } {
  const rows = parse(readFileSync(path, 'utf8'), {
    columns: (header: string[]) => header.map((h) => h.split('; ').pop()!.trim()),
    bom: true,
    skip_empty_lines: true,
  }) as Row[];
  const kept = rows.filter((r) => !isNumberedVariety(r.name));
  return { foods: kept.map(ifctFood), skippedVarieties: rows.length - kept.length };
}
