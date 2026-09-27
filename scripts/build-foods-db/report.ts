// The summary printed after every build: what came in, what was dropped, and spot checks of
// converted values next to what the source file said.

import type { NutrientKey } from '../../src/lib/nutrients';
import { oilAdjustedPer100, oilFactor } from '../../src/lib/oil';
import type { DedupeResult } from './dedupe';
import type { RecipeStats } from './recipes';
import { type FoodRecord, type Source, refOf } from './types';
import type { FoodRow } from './write';

/** What happened to INDB servings after the recipe fixes. */
export interface ServingSummary {
  /** Shrunk with their recipe (frying oil, drained water). */
  resized: number;
  /** Piece count from indb_servings.csv. */
  overridden: number;
  /** Still not believable, so left out ("Tutti frutti cake (1 cake = 848 g, 2950 kcal)"). */
  dropped: string[];
}

export interface BuildSummary {
  read: { source: Source; rows: number; notes: string[] }[];
  dedupe: DedupeResult;
  recipes: RecipeStats;
  servings: ServingSummary;
  foods: FoodRow[];
  records: Map<string, FoodRecord>;
  synonymTermsCurated: number;
  fileSizeBytes: number;
  outputPath: string;
}

const SOURCES: Source[] = ['indb', 'ifct', 'usda_fnd', 'usda_sr'];

/** Foods to check by hand against the source files: a mix of every source and conversion. */
export const SPOT_CHECK_REFS = [
  'ifct:A015', // rice — kJ → kcal, g → mg
  'ifct:C033', // spinach — β-carotene → vitamin A RAE
  'ifct:T005', // groundnut oil — no energy in IFCT, estimated from fat
  'ifct:L002', // cow milk
  'indb:ASC096', // chapati — roti units
  'indb:ASC151', // moong dal — katori
  'indb:ASC001', // hot tea — Hindi name from brackets
  'usda_sr:171287', // egg — USDA SR, piece
  'usda_sr:173944', // banana — USDA SR
  'usda_fnd:321358', // hummus — USDA Foundation
];

const SPOT_NUTRIENTS: NutrientKey[] = [
  'energy_kcal',
  'protein_g',
  'carb_g',
  'fat_g',
  'fibre_g',
  'sodium_mg',
  'iron_mg',
  'vit_a_ug',
  'vit_c_mg',
];

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);
const fmt = (v: number | null) => (v === null ? '—' : String(Math.round(v * 100) / 100));
const pct = (part: number, whole: number) =>
  whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`;

export function printReport(s: BuildSummary): void {
  const log = console.log;
  const line = () => log('─'.repeat(78));

  log('\nfoods.db build report');
  line();
  log('Read from sources');
  for (const r of s.read) {
    log(`  ${pad(r.source, 9)} ${lpad(r.rows, 6)} foods read`);
    for (const note of r.notes) log(`  ${pad('', 9)}        ${note}`);
  }

  const bySourceDropped = new Map<Source, number>();
  for (const d of s.dedupe.dropped) {
    bySourceDropped.set(d.dropped.source, (bySourceDropped.get(d.dropped.source) ?? 0) + 1);
  }
  line();
  log(`Duplicates removed: ${s.dedupe.dropped.length}`);
  for (const src of SOURCES) {
    if (bySourceDropped.get(src)) log(`  ${pad(src, 9)} ${lpad(bySourceDropped.get(src)!, 6)}`);
  }
  log('  first 12 (dropped ← kept):');
  for (const d of s.dedupe.dropped.slice(0, 12)) {
    const kept = s.records.get(d.keptRef)?.name ?? d.keptRef;
    log(`    ${d.dropped.name}  (${refOf(d.dropped)})  ←  ${kept}  (${d.keptRef})`);
  }

  line();
  log('Foods in foods.db');
  log(
    `  ${pad('source', 9)} ${lpad('foods', 6)}  ${lpad('kcal est.', 9)}  ${lpad('no macro', 8)}  complete: macro / other / mineral / vitamin`,
  );
  for (const src of SOURCES) {
    const rows = s.foods.filter((f) => f.source === src);
    const est = rows.filter((f) => f.energyEstimated).length;
    const noMacro = rows.filter(
      (f) =>
        f.nutrients.protein_g === null || f.nutrients.carb_g === null || f.nutrients.fat_g === null,
    ).length;
    const c = (k: 'complete_macro' | 'complete_other' | 'complete_mineral' | 'complete_vitamin') =>
      pct(rows.filter((f) => f[k] === 1).length, rows.length);
    log(
      `  ${pad(src, 9)} ${lpad(rows.length, 6)}  ${lpad(est, 9)}  ${lpad(noMacro, 8)}  ` +
        `${c('complete_macro')} / ${c('complete_other')} / ${c('complete_mineral')} / ${c('complete_vitamin')}`,
    );
  }
  log(`  ${pad('total', 9)} ${lpad(s.foods.length, 6)}`);

  const noEnergy = s.foods.filter((f) => f.nutrients.energy_kcal === null);
  const missingMacro = s.foods.filter(
    (f) =>
      f.nutrients.protein_g === null || f.nutrients.carb_g === null || f.nutrients.fat_g === null,
  );
  log(
    `\n  Foods missing calories: ${noEnergy.length} (foods with no energy and no macros are left out)`,
  );
  log(
    `  Foods with kcal estimated from macros: ${s.foods.filter((f) => f.energyEstimated).length}`,
  );
  log(`  Foods missing protein, carbs or fat: ${missingMacro.length}`);
  for (const f of missingMacro.slice(0, 8)) {
    const n = f.nutrients;
    log(`    ${f.name} (${f.source}) — P ${fmt(n.protein_g)} C ${fmt(n.carb_g)} F ${fmt(n.fat_g)}`);
  }

  line();
  log('Categories');
  const cats = new Map<string, number>();
  for (const f of s.foods) cats.set(f.category, (cats.get(f.category) ?? 0) + 1);
  const catList = [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`);
  for (let i = 0; i < catList.length; i += 6) log(`  ${catList.slice(i, i + 6).join(' · ')}`);

  line();
  const withSyn = s.foods.filter((f) => f.synonyms.length > 0).length;
  const synRows = s.foods.reduce((n, f) => n + f.synonyms.length, 0);
  log(`Synonyms: ${s.synonymTermsCurated} curated terms → ${synRows} rows on ${withSyn} foods`);
  const units = new Map<string, number>();
  for (const f of s.foods) units.set(f.defaultUnit, (units.get(f.defaultUnit) ?? 0) + 1);
  log(
    `Default units: ${[...units.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([u, n]) => `${u} ${n}`)
      .join(' · ')}`,
  );

  printRecipes(s);

  line();
  log('Spot checks — foods.db value  |  what the source file says');
  for (const ref of SPOT_CHECK_REFS) {
    const row = s.foods.find((f) => `${f.source}:${f.sourceCode}` === ref);
    const rec = s.records.get(ref);
    if (!row || !rec) {
      log(`\n  ${ref}: not in foods.db (dropped or missing)`);
      continue;
    }
    const unitList = row.units.map((u) => `${u.unit} ${u.grams} g`).join(', ') || '—';
    log(
      `\n  ${row.name}${row.nameHi ? ` · ${row.nameHi}` : ''}  [${ref}, ${row.category}, ${row.diet ?? 'diet ?'}]`,
    );
    log(`    default ${row.defaultQty} ${row.defaultUnit} · units: ${unitList}`);
    for (const k of SPOT_NUTRIENTS) {
      log(`    ${pad(k, 15)} ${lpad(fmt(row.nutrients[k]), 9)}  |  ${rec.trace[k] ?? '—'}`);
    }
  }

  line();
  log(`Wrote ${s.outputPath} (${(s.fileSizeBytes / 1024 / 1024).toFixed(1)} MB)\n`);
}

/** Dishes to show Less / Normal / More oil for: a dal, a paratha, a pulao and a curry. */
export const OIL_CHECK_REFS = ['indb:ASC151', 'indb:ASC097', 'indb:ASC114', 'indb:ASC215'];

function printRecipes(s: BuildSummary): void {
  const log = console.log;
  const r = s.recipes;
  log('─'.repeat(78));
  log(`INDB recipes: ${r.dishes} dishes, ${r.rows} ingredient rows`);
  log(
    `  linked: IFCT ${r.linkedIfct} · indb_ingredients.csv ${r.linkedCurated} · water ${r.zero} · ` +
      `not linked ${r.unlinked} (${pct(r.rows - r.unlinked, r.rows)} linked)`,
  );
  log(`  rows with no usable amount: ${r.noGrams}`);
  log(`  dishes with a fat ingredient (oil control): ${r.dishesWithFat}`);
  log(
    `  energy check (ingredient kcal vs INDB kcal): ${r.energyWithin5pct} of ${r.energyChecked} ` +
      `dishes within ±5% (${pct(r.energyWithin5pct, r.energyChecked)})`,
  );
  log(
    `    furthest off: ${r.energyOutliers
      .slice(0, 5)
      .map(([n, x]) => `${n} ${Math.round(x * 100)}%`)
      .join(' · ')}`,
  );
  log(
    `  frying oil cut to what the food soaks up: ${r.fryingFixed} dishes, ` +
      `${Math.round(r.fryingOilRemovedG / 1000)} kg of oil left in the pan`,
  );
  log(`  egg-boiling / steaming water taken out: ${r.drainedFixed} dishes`);
  const sv = s.servings;
  log(
    `  INDB servings: ${sv.resized} resized with their recipe · ${sv.overridden} from ` +
      `indb_servings.csv · ${sv.dropped.length} left out (not believable):`,
  );
  for (let i = 0; i < sv.dropped.length; i += 3)
    log(`    ${sv.dropped.slice(i, i + 3).join(' · ')}`);
  log(`  most-used unlinked ingredients (add to indb_ingredients.csv to link them):`);
  log(
    `    ${r.unlinkedCodes
      .slice(0, 8)
      .map(([k, n]) => `${k} ×${n}`)
      .join(' · ')}`,
  );

  log('\n  Oil control check — kcal per 100 g at Less / Normal / More');
  for (const ref of OIL_CHECK_REFS) {
    const dish = s.foods.find((f) => `${f.source}:${f.sourceCode}` === ref);
    if (!dish) continue;
    const fats = dish.recipe.filter((i) => i.isFat);
    const fatGrams = fats.reduce((n, i) => n + i.grams, 0);
    const fatKcal = fats.reduce((n, i) => n + (i.grams / 100) * (i.nutrients.energy_kcal ?? 0), 0);
    const y = dish.yieldG ?? 0;
    const kcal = ([-1, 0, 1] as const).map((level) =>
      fmt(oilAdjustedPer100(dish.nutrients.energy_kcal, fatKcal, fatGrams, y, oilFactor(level))),
    );
    log(
      `    ${pad(dish.name, 22)} ${kcal.join(' / ')}  ` +
        `(fat ${fmt(fatGrams)} g in a ${fmt(y)} g recipe: ${fats.map((f) => f.name).join(', ') || 'none'})`,
    );
  }
}
