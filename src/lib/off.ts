// Open Food Facts (SPEC §5.13): the address to ask, and turning its answer into Kalorie's
// nutrients per 100 g (SPEC §3). The request itself is made in src/features/barcode/.
//
// Open Food Facts keeps every `<nutrient>_100g` value in grams (energy in kcal or kJ), so
// milligram and microgram nutrients are × 1000 and × 1,000,000 here. Drinks are per 100 ml,
// stored as per 100 g (density 1).

import {
  emptyNutrients,
  estimateEnergyKcal,
  kjToKcal,
  type NutrientKey,
  type NutrientValues,
} from './nutrients';

const API = 'https://world.openfoodfacts.org/api/v2/product';

/** Only the fields Kalorie uses, so the answer stays small. */
export const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'quantity',
  'product_quantity',
  'product_quantity_unit',
] as const;

/** The product address for a barcode. */
export function offProductUrl(barcode: string): string {
  return `${API}/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS.join(',')}`;
}

/**
 * The User-Agent Open Food Facts asks apps to send: app name, version and a way to reach the
 * developer ("Kalorie/1.0.0 (someone@example.com)"). Without a contact, the app ID is used.
 */
export function offUserAgent(version: string, contact?: string | null): string {
  return `Kalorie/${version} (${contact?.trim() || 'com.mynklabs.kalorie'})`;
}

/** Open Food Facts name → Kalorie nutrient, and what to multiply grams by. */
const NUTRIMENTS: readonly [off: string, key: NutrientKey, factor: number][] = [
  ['proteins', 'protein_g', 1],
  ['carbohydrates', 'carb_g', 1],
  ['fat', 'fat_g', 1],
  ['fiber', 'fibre_g', 1],
  ['sugars', 'sugar_g', 1],
  ['saturated-fat', 'sat_fat_g', 1],
  ['monounsaturated-fat', 'mufa_g', 1],
  ['polyunsaturated-fat', 'pufa_g', 1],
  ['trans-fat', 'trans_fat_g', 1],
  ['cholesterol', 'cholesterol_mg', 1e3],
  ['sodium', 'sodium_mg', 1e3],
  ['potassium', 'potassium_mg', 1e3],
  ['calcium', 'calcium_mg', 1e3],
  ['iron', 'iron_mg', 1e3],
  ['magnesium', 'magnesium_mg', 1e3],
  ['phosphorus', 'phosphorus_mg', 1e3],
  ['zinc', 'zinc_mg', 1e3],
  ['copper', 'copper_mg', 1e3],
  ['manganese', 'manganese_mg', 1e3],
  ['selenium', 'selenium_ug', 1e6],
  ['iodine', 'iodine_ug', 1e6],
  ['vitamin-a', 'vit_a_ug', 1e6],
  ['vitamin-b1', 'thiamine_mg', 1e3],
  ['vitamin-b2', 'riboflavin_mg', 1e3],
  ['vitamin-pp', 'niacin_mg', 1e3],
  ['pantothenic-acid', 'pantothenic_mg', 1e3],
  ['vitamin-b6', 'vit_b6_mg', 1e3],
  ['biotin', 'biotin_ug', 1e6],
  ['vitamin-b9', 'folate_ug', 1e6],
  ['folates', 'folate_ug', 1e6],
  ['vitamin-b12', 'vit_b12_ug', 1e6],
  ['vitamin-c', 'vit_c_mg', 1e3],
  ['vitamin-d', 'vit_d_ug', 1e6],
  ['vitamin-e', 'vit_e_mg', 1e3],
  ['vitamin-k', 'vit_k_ug', 1e6],
];

/** Sodium is 40% of salt: labels that give only salt still give sodium. */
const SODIUM_IN_SALT = 0.4;

type Nutriments = Record<string, unknown>;

/** A number that makes sense as an amount (not negative, not text). */
function amount(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * One nutrient per 100 g: `<name>_100g`, or else `<name>_serving` scaled up from the serving
 * size (a label entered per serving only).
 */
function per100(nutriments: Nutriments, name: string, servingG: number | null): number | null {
  const direct = amount(nutriments[`${name}_100g`]);
  if (direct !== null) return direct;
  const serving = amount(nutriments[`${name}_serving`]);
  return serving !== null && servingG ? (serving * 100) / servingG : null;
}

/** Open Food Facts' `nutriments` → Kalorie's 35 nutrients per 100 g. Missing = unknown. */
export function mapOffNutriments(nutriments: Nutriments, servingG: number | null): NutrientValues {
  const values = emptyNutrients();
  for (const [name, key, factor] of NUTRIMENTS) {
    if (values[key] !== null) continue; // folate: vitamin-b9 first, then folates
    const grams = per100(nutriments, name, servingG);
    values[key] = grams === null ? null : grams * factor;
  }
  if (values.sodium_mg === null) {
    const salt = per100(nutriments, 'salt', servingG);
    values.sodium_mg = salt === null ? null : salt * SODIUM_IN_SALT * 1e3;
  }
  // `energy` on its own is in kJ.
  const kj = per100(nutriments, 'energy-kj', servingG) ?? per100(nutriments, 'energy', servingG);
  values.energy_kcal =
    per100(nutriments, 'energy-kcal', servingG) ??
    kjToKcal(kj) ??
    estimateEnergyKcal(values.protein_g, values.carb_g, values.fat_g);
  return values;
}

/**
 * True when the numbers could be real: energy is known and no more than pure fat (900 kcal per
 * 100 g, with a little room), and protein + carbs + fat fit in 100 g. Open Food Facts is filled
 * in by volunteers, and a typo there shouldn't end up in someone's log.
 */
export function isPlausible(values: NutrientValues): boolean {
  const kcal = values.energy_kcal;
  if (kcal === null || kcal > 950) return false;
  const macros = (values.protein_g ?? 0) + (values.carb_g ?? 0) + (values.fat_g ?? 0);
  return macros <= 105;
}

/** A product as Kalorie saves it. Nutrients are per 100 g. */
export interface OffProduct {
  barcode: string;
  /** `null` when Open Food Facts has no name for it. */
  name: string | null;
  brand: string | null;
  /** Grams (or ml for drinks) in one serving, if known. */
  servingG: number | null;
  /** Grams (or ml) in the whole pack, if known. */
  packG: number | null;
  /** Sold by volume (ml, l): the amount can be picked in ml. */
  isLiquid: boolean;
  nutrients: NutrientValues;
}

export type OffLookup =
  /** Found, with numbers that can be logged. */
  | { status: 'found'; product: OffProduct }
  /** Found, but without usable nutrition numbers: the label form, filled in with the name. */
  | { status: 'no_nutrition'; product: OffProduct }
  | { status: 'not_found' };

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** "ml", "l", "cl" as a unit of a quantity like "200 ml" or "1 L". */
const LIQUID = /\d\s*(ml|cl|l)\b/i;

/** Grams or ml in a pack or serving; drinks in litres or centilitres are turned into ml. */
function quantity(value: unknown, unit: unknown): number | null {
  const n = amount(value);
  if (n === null || n === 0) return null;
  const u = typeof unit === 'string' ? unit.toLowerCase() : '';
  return u === 'l' ? n * 1000 : u === 'cl' ? n * 10 : n;
}

/**
 * Reads the answer to a product request. `httpStatus` 404 or `status: 0` means Open Food Facts
 * doesn't know the barcode. Throws if the answer isn't an Open Food Facts product answer.
 */
export function parseOffResponse(barcode: string, httpStatus: number, body: unknown): OffLookup {
  const json = (body ?? {}) as { status?: unknown; product?: unknown };
  if (httpStatus === 404 || json.status === 0) return { status: 'not_found' };
  if (httpStatus !== 200 || typeof json.product !== 'object' || json.product === null) {
    throw new Error(`Open Food Facts answered ${httpStatus}`);
  }
  const p = json.product as Record<string, unknown>;

  const servingG = quantity(p.serving_quantity, p.serving_quantity_unit);
  const packG = quantity(p.product_quantity, p.product_quantity_unit);
  const units = [p.serving_quantity_unit, p.product_quantity_unit].map((u) =>
    typeof u === 'string' ? u.toLowerCase() : '',
  );
  const isLiquid =
    units.some((u) => u === 'ml' || u === 'l' || u === 'cl') ||
    LIQUID.test(String(p.quantity ?? '')) ||
    LIQUID.test(String(p.serving_size ?? ''));

  const nutriments =
    typeof p.nutriments === 'object' && p.nutriments !== null ? (p.nutriments as Nutriments) : {};
  const product: OffProduct = {
    barcode,
    name: text(p.product_name_en) ?? text(p.product_name),
    // "Maggi, Nestlé" → "Maggi": the first brand is the one on the front of the pack.
    brand: text(String(p.brands ?? '').split(',')[0]),
    servingG,
    packG,
    isLiquid,
    nutrients: mapOffNutriments(nutriments, servingG),
  };
  return { status: isPlausible(product.nutrients) ? 'found' : 'no_nutrition', product };
}
