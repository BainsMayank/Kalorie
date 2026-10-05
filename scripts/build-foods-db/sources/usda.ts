/// <reference types="node" />
// USDA FoodData Central: Foundation Foods and SR Legacy (public domain). Both use the same CSV
// layout: food.csv (names), food_nutrient.csv (one row per food × nutrient), food_portion.csv.

import { join } from 'node:path';

import {
  availableCarb,
  emptyNutrients,
  estimateEnergyKcal,
  sumKnown,
  vitaminAUg,
  type NutrientKey,
} from '../../../src/lib/nutrients';
import { USDA_EXCLUDED_CATEGORIES, usdaCategory, usdaDiet } from '../classify';
import { readCsv } from '../curated';
import type { FoodRecord, Source, UnitRow } from '../types';

// USDA nutrient ids (nutrient.csv) that map straight onto our columns. Units already match.
const DIRECT: [NutrientKey, number][] = [
  ['protein_g', 1003],
  ['fibre_g', 1079],
  ['sat_fat_g', 1258],
  ['mufa_g', 1292],
  ['pufa_g', 1293],
  ['trans_fat_g', 1257],
  ['cholesterol_mg', 1253],
  ['sodium_mg', 1093],
  ['potassium_mg', 1092],
  ['calcium_mg', 1087],
  ['iron_mg', 1089],
  ['magnesium_mg', 1090],
  ['phosphorus_mg', 1091],
  ['zinc_mg', 1095],
  ['copper_mg', 1098],
  ['manganese_mg', 1101],
  ['selenium_ug', 1103],
  ['iodine_ug', 1100],
  ['thiamine_mg', 1165],
  ['riboflavin_mg', 1166],
  ['niacin_mg', 1167],
  ['pantothenic_mg', 1170],
  ['vit_b6_mg', 1175],
  ['biotin_ug', 1176],
  ['folate_ug', 1177],
  ['vit_b12_ug', 1178],
  ['vit_c_mg', 1162],
  ['vit_d_ug', 1114],
  ['vit_e_mg', 1109],
];

const ID = {
  energyKcal: 1008,
  energyAtwaterGeneral: 2047,
  energyAtwaterSpecific: 2048,
  fat: 1004,
  fatNlea: 1085,
  carbByDifference: 1005,
  carbBySummation: 1050,
  sugarsTotal: 2000,
  sugarsNlea: 1063,
  vitARae: 1106,
  retinol: 1105,
  betaCarotene: 1107,
  alphaCarotene: 1108,
  betaCryptoxanthin: 1120,
  vitK1: 1185,
  vitK2Mk4: 1183,
};

type Amounts = Map<number, number>;

/** Converts one USDA food's nutrient amounts into our columns, with a trace for the report. */
export function usdaNutrients(amounts: Amounts): {
  nutrients: FoodRecord['nutrients'];
  trace: FoodRecord['trace'];
  energyEstimated: boolean;
} {
  const get = (id: number) => amounts.get(id) ?? null;
  const firstOf = (...ids: number[]) => {
    for (const id of ids) if (amounts.has(id)) return { id, value: amounts.get(id)! };
    return null;
  };
  const nutrients = emptyNutrients();
  const trace: FoodRecord['trace'] = {};

  for (const [key, id] of DIRECT) {
    nutrients[key] = get(id);
    trace[key] = `#${id} ${get(id) ?? '—'}`;
  }

  const fat = firstOf(ID.fat, ID.fatNlea);
  nutrients.fat_g = fat?.value ?? null;
  trace.fat_g = fat ? `#${fat.id} ${fat.value}` : '—';

  // Available carbs: by difference minus fibre; "by summation" already excludes fibre.
  if (amounts.has(ID.carbByDifference)) {
    nutrients.carb_g = availableCarb(get(ID.carbByDifference), nutrients.fibre_g);
    trace.carb_g = `#${ID.carbByDifference} ${get(ID.carbByDifference)} − fibre ${nutrients.fibre_g ?? 0}`;
  } else {
    nutrients.carb_g = get(ID.carbBySummation);
    trace.carb_g = `#${ID.carbBySummation} ${nutrients.carb_g ?? '—'}`;
  }

  const sugar = firstOf(ID.sugarsTotal, ID.sugarsNlea);
  nutrients.sugar_g = sugar?.value ?? null;
  trace.sugar_g = sugar ? `#${sugar.id} ${sugar.value}` : '—';

  // Vitamin A with ICMR-NIN's factors (β-carotene 6:1, α-carotene and β-cryptoxanthin 12:1,
  // p. 10) when USDA lists retinol and β-carotene; else USDA's own RAE (12:1 / 24:1).
  if (!amounts.has(ID.vitARae) || (amounts.has(ID.retinol) && amounts.has(ID.betaCarotene))) {
    nutrients.vit_a_ug = vitaminAUg({
      retinolUg: get(ID.retinol),
      betaCaroteneUg: get(ID.betaCarotene),
      otherCarotenoidsUg: sumKnown(get(ID.alphaCarotene), get(ID.betaCryptoxanthin)),
    });
    trace.vit_a_ug = 'retinol + β-carotene/6 + (α-carotene + β-cryptoxanthin)/12';
  } else {
    nutrients.vit_a_ug = get(ID.vitARae);
    trace.vit_a_ug = `#${ID.vitARae} ${nutrients.vit_a_ug} RAE`;
  }

  nutrients.vit_k_ug = sumKnown(get(ID.vitK1), get(ID.vitK2Mk4));
  trace.vit_k_ug = `#${ID.vitK1} ${get(ID.vitK1) ?? '—'} + #${ID.vitK2Mk4} ${get(ID.vitK2Mk4) ?? '—'}`;

  let energyEstimated = false;
  const energy = firstOf(ID.energyKcal, ID.energyAtwaterGeneral, ID.energyAtwaterSpecific);
  if (energy) {
    nutrients.energy_kcal = energy.value;
    trace.energy_kcal = `#${energy.id} ${energy.value} kcal`;
  } else {
    nutrients.energy_kcal = estimateEnergyKcal(
      nutrients.protein_g,
      nutrients.carb_g,
      nutrients.fat_g,
    );
    energyEstimated = nutrients.energy_kcal !== null;
    trace.energy_kcal = 'estimated 4P + 4C + 9F';
  }
  return { nutrients, trace, energyEstimated };
}

// Portion names we skip: weights (we already offer grams), packages, and odd lab measures.
const SKIPPED_PORTION =
  /^(oz|fl oz|lb|lbs|pound|quart|pint|gallon|ml|milliliter|liter|litre|package|packet|container|can|bottle|jar|box|bunch|paired|steak|roast|cubic|inch|undetermined)\b/;

/** USDA household measure → our unit key and label. `null` when we don't offer it. */
export function usdaPortionUnit(
  measure: string,
  modifier: string,
): { unit: string; label: string } | null {
  const m = measure.trim();
  const useModifier = m === '' || m === 'undetermined';
  const text = (useModifier ? modifier : [m, modifier].filter(Boolean).join(', ')).trim();
  const lower = text.toLowerCase();
  if (!lower || SKIPPED_PORTION.test(lower)) return null;
  const label = text.replace(/\s+/g, ' ');
  if (/^cups?\b/.test(lower)) return { unit: 'cup', label };
  if (/^(tbsp|tablespoons?)\b/.test(lower)) return { unit: 'tbsp', label };
  if (/^(tsp|teaspoons?)\b/.test(lower)) return { unit: 'tsp', label };
  if (/^slices?\b/.test(lower)) return { unit: 'slice', label };
  if (/^serving\b/.test(lower)) return { unit: 'serving', label };
  if (/^small\b/.test(lower)) return { unit: 'piece_s', label };
  if (/^(large|extra large|jumbo)\b/.test(lower)) return { unit: 'piece_l', label };
  return { unit: 'piece', label };
}

export interface UsdaReadResult {
  foods: FoodRecord[];
  excludedByCategory: number;
  droppedNoEnergy: string[];
}

/** Reads one FoodData Central CSV folder. `source` is usda_fnd (Foundation) or usda_sr (SR Legacy). */
export function readUsda(
  dir: string,
  source: Extract<Source, 'usda_fnd' | 'usda_sr'>,
): UsdaReadResult {
  const csv = (file: string) => readCsv(join(dir, file));

  // Foundation's food.csv also holds lab samples and old versions; the current foods are the
  // ones listed in foundation_food.csv. SR Legacy's food.csv is all foods.
  const listFile = source === 'usda_fnd' ? 'foundation_food.csv' : 'sr_legacy_food.csv';
  const current = new Set(csv(listFile).map((r) => r.fdc_id));
  const categories = new Map(csv('food_category.csv').map((r) => [r.id, r.description]));
  const measures = new Map(csv('measure_unit.csv').map((r) => [r.id, r.name]));

  const foods = csv('food.csv').filter((r) => current.has(r.fdc_id));
  const kept = foods.filter(
    (r) => !USDA_EXCLUDED_CATEGORIES.has(categories.get(r.food_category_id) ?? ''),
  );
  const keptIds = new Set(kept.map((r) => r.fdc_id));

  const amounts = new Map<string, Amounts>();
  for (const r of csv('food_nutrient.csv')) {
    if (!keptIds.has(r.fdc_id) || r.amount === '') continue;
    const map = amounts.get(r.fdc_id) ?? new Map<number, number>();
    map.set(Number(r.nutrient_id), Number(r.amount));
    amounts.set(r.fdc_id, map);
  }

  const portions = new Map<string, UnitRow[]>();
  const portionRows = csv('food_portion.csv')
    .filter((r) => keptIds.has(r.fdc_id))
    .sort((a, b) => Number(a.seq_num || 0) - Number(b.seq_num || 0));
  for (const r of portionRows) {
    const amount = Number(r.amount) || 1;
    const grams = Number(r.gram_weight) / amount;
    const measureName = measures.get(r.measure_unit_id) ?? '';
    const measure = [measureName === 'undetermined' ? '' : measureName, r.portion_description]
      .filter(Boolean)
      .join(' ');
    const unit = usdaPortionUnit(measure, r.modifier ?? '');
    if (!unit || !(grams > 0)) continue;
    const list = portions.get(r.fdc_id) ?? [];
    if (!list.some((p) => p.unit === unit.unit)) {
      list.push({ ...unit, grams: Math.round(grams * 10) / 10 });
    }
    portions.set(r.fdc_id, list);
  }

  const result: FoodRecord[] = [];
  const droppedNoEnergy: string[] = [];
  for (const r of kept) {
    const categoryName = categories.get(r.food_category_id) ?? '';
    const { nutrients, trace, energyEstimated } = usdaNutrients(amounts.get(r.fdc_id) ?? new Map());
    if (nutrients.energy_kcal === null) {
      droppedNoEnergy.push(r.description);
      continue;
    }
    const { category, kind } = usdaCategory(categoryName, r.description);
    result.push({
      source,
      sourceCode: r.fdc_id,
      name: r.description.trim(),
      nameHi: null,
      sourceTerms: [],
      sourceCategory: categoryName,
      kind,
      category,
      diet: usdaDiet(category, r.description),
      nutrients,
      energyEstimated,
      trace,
      serving: null,
      portions: portions.get(r.fdc_id) ?? [],
    });
  }
  return { foods: result, excludedByCategory: foods.length - kept.length, droppedNoEnergy };
}
