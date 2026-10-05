// ICMR-NIN 2020 nutrient requirements for Indians, typed in from the official short report
// ("Short Report of Nutrient Requirements for Indians — RDA and EAR 2020", data/raw/ICMR-NIN.pdf).
//
// Every value has the page it comes from beside it. `page` is the number printed on the page
// (the orange circle); in a PDF viewer it is page + PDF_PAGE_OFFSET.
//   p. 12  Summary of EAR          p. 15  Elderly (≥ 60 y): EAR + RDA
//   p. 13  Summary of RDA          p. 16  AMDR (% of energy) + other minerals in adults
//   p. 14  Dietary fat             p. 17  Tolerable upper limits (TUL)
//   pp. 4–10  text: protein, fibre, pantothenic acid, biotin, vitamins D, E, K
//
// Kalorie gives targets only to adults (18+, SPEC §1), so only the groups an adult can fall in
// are here: 16–18 y (ICMR's group for 18-year-olds), adults, and ≥ 60 y. Pregnancy and lactation
// are not asked in onboarding, so their rows are left out.
//
// Units are Kalorie's (SPEC §3). The report gives vitamin D in IU: 1 µg = 40 IU.

import type { NutrientKey } from '../nutrients';

export const PDF_PAGE_OFFSET = 3;

/** ICMR's groups for people 16 and over. */
export type IcmrGroup = 'boy_16_18' | 'girl_16_18' | 'man' | 'woman' | 'man_60' | 'woman_60';

/** ICMR's three "category of work" levels. */
export type IcmrActivity = 'sedentary' | 'moderate' | 'heavy';

/**
 * ear = estimated average requirement · rda = recommended dietary allowance ·
 * ai = adequate intake (used where there is too little data for an RDA) · tul = tolerable upper limit.
 */
export type IcmrKind = 'ear' | 'rda' | 'ai' | 'tul';

export type IcmrNutrient = NutrientKey;

export interface IcmrRow {
  group: IcmrGroup;
  nutrient: IcmrNutrient;
  kind: IcmrKind;
  /** Only set when the value depends on the category of work. */
  activity?: IcmrActivity;
  value: number;
  /** Printed page number in the report. */
  page: number;
  note?: string;
}

const IU_PER_UG_VIT_D = 40;

type Values = number | readonly [sedentary: number, moderate: number, heavy: number];

/** One table cell (or one cell per category of work). */
function row(
  group: IcmrGroup,
  kind: IcmrKind,
  nutrient: IcmrNutrient,
  values: Values,
  page: number,
  note?: string,
): IcmrRow[] {
  if (typeof values === 'number') return [{ group, nutrient, kind, value: values, page, note }];
  const levels: IcmrActivity[] = ['sedentary', 'moderate', 'heavy'];
  return levels.map((activity, i) => ({
    group,
    nutrient,
    kind,
    activity,
    value: values[i],
    page,
    note,
  }));
}

/** A table row: one group, one kind, many nutrients, all on the same page. */
function tableRow(
  group: IcmrGroup,
  kind: IcmrKind,
  page: number,
  cells: Partial<Record<IcmrNutrient, Values>>,
): IcmrRow[] {
  return Object.entries(cells).flatMap(([nutrient, values]) =>
    row(group, kind, nutrient as IcmrNutrient, values as Values, page),
  );
}

/** Vitamin D is printed in IU; stored in µg with the printed value kept in the note. */
function vitD(group: IcmrGroup, kind: IcmrKind, iu: number, page: number): IcmrRow[] {
  return row(group, kind, 'vit_d_ug', iu / IU_PER_UG_VIT_D, page, `printed as ${iu} IU`);
}

export const ICMR_ROWS: readonly IcmrRow[] = [
  // --- p. 12 — Summary of EAR ----------------------------------------------------------------
  // Energy EAR = the estimated energy requirement (footnote **). Kalorie uses Mifflin-St Jeor
  // for calorie targets (SPEC §5.4); these are kept for reference.
  ...tableRow('man', 'ear', 12, {
    energy_kcal: [2110, 2710, 3470],
    protein_g: 43.0,
    calcium_mg: 800,
    magnesium_mg: 370,
    iron_mg: 11,
    zinc_mg: 14.1,
    iodine_ug: 95,
    thiamine_mg: [1.2, 1.5, 1.9],
    riboflavin_mg: [1.6, 2.1, 2.7],
    niacin_mg: [12, 15, 19],
    vit_b6_mg: [1.6, 2.1, 2.6],
    folate_ug: 250,
    vit_b12_ug: 2,
    vit_c_mg: 65,
    vit_a_ug: 460,
  }),
  ...vitD('man', 'ear', 400, 12),
  ...tableRow('woman', 'ear', 12, {
    energy_kcal: [1660, 2130, 2720],
    protein_g: 36.0,
    calcium_mg: 800,
    magnesium_mg: 310,
    iron_mg: 15,
    zinc_mg: 11.0,
    iodine_ug: 95,
    thiamine_mg: [1.1, 1.4, 1.8],
    riboflavin_mg: [1.6, 2.0, 2.6],
    niacin_mg: [9, 12, 15],
    vit_b6_mg: [1.6, 1.6, 2.1],
    folate_ug: 180,
    vit_b12_ug: 2,
    vit_c_mg: 55,
    vit_a_ug: 390,
  }),
  ...vitD('woman', 'ear', 400, 12),
  ...tableRow('boy_16_18', 'ear', 12, {
    energy_kcal: 3320,
    protein_g: 45.0,
    calcium_mg: 850,
    magnesium_mg: 367,
    iron_mg: 18,
    zinc_mg: 14.7,
    iodine_ug: 100,
    thiamine_mg: 1.9,
    riboflavin_mg: 2.5,
    niacin_mg: 19,
    vit_b6_mg: 2.5,
    folate_ug: 286,
    vit_b12_ug: 2,
    vit_c_mg: 70,
    vit_a_ug: 480,
  }),
  ...vitD('boy_16_18', 'ear', 400, 12),
  ...tableRow('girl_16_18', 'ear', 12, {
    energy_kcal: 2500,
    protein_g: 37.0,
    calcium_mg: 850,
    magnesium_mg: 317,
    iron_mg: 18,
    zinc_mg: 11.8,
    iodine_ug: 100,
    thiamine_mg: 1.4,
    riboflavin_mg: 1.9,
    niacin_mg: 14,
    vit_b6_mg: 1.9,
    folate_ug: 223,
    vit_b12_ug: 2,
    vit_c_mg: 57,
    vit_a_ug: 400,
  }),
  ...vitD('girl_16_18', 'ear', 400, 12),

  // --- p. 13 — Summary of RDA ----------------------------------------------------------------
  // Dietary fibre is marked * = adequate intake, so it is stored as `ai`.
  ...row('man', 'ai', 'fibre_g', [30, 40, 50], 13),
  ...tableRow('man', 'rda', 13, {
    protein_g: 54.0,
    calcium_mg: 1000,
    magnesium_mg: 440,
    iron_mg: 19,
    zinc_mg: 17,
    iodine_ug: 140,
    thiamine_mg: [1.4, 1.8, 2.3],
    riboflavin_mg: [2.0, 2.5, 3.2],
    niacin_mg: [14, 18, 23],
    vit_b6_mg: [1.9, 2.4, 3.1],
    folate_ug: 300,
    vit_b12_ug: 2.2,
    vit_c_mg: 80,
    vit_a_ug: 1000,
  }),
  ...vitD('man', 'rda', 600, 13),
  ...row('woman', 'ai', 'fibre_g', [25, 30, 40], 13),
  ...tableRow('woman', 'rda', 13, {
    protein_g: 46.0,
    calcium_mg: 1000,
    magnesium_mg: 370,
    iron_mg: 29,
    zinc_mg: 13.2,
    iodine_ug: 140,
    thiamine_mg: [1.4, 1.7, 2.2],
    riboflavin_mg: [1.9, 2.4, 3.1],
    niacin_mg: [11, 14, 18],
    vit_b6_mg: [1.9, 1.9, 2.4],
    folate_ug: 220,
    vit_b12_ug: 2.2,
    vit_c_mg: 65,
    vit_a_ug: 840,
  }),
  ...vitD('woman', 'rda', 600, 13),
  ...row('boy_16_18', 'ai', 'fibre_g', 50, 13),
  ...tableRow('boy_16_18', 'rda', 13, {
    protein_g: 55.0,
    calcium_mg: 1050,
    magnesium_mg: 440,
    iron_mg: 26,
    zinc_mg: 17.6,
    iodine_ug: 140,
    thiamine_mg: 2.2,
    riboflavin_mg: 3.1,
    niacin_mg: 22,
    vit_b6_mg: 3.0,
    folate_ug: 340,
    vit_b12_ug: 2.2,
    vit_c_mg: 85,
    vit_a_ug: 1000,
  }),
  ...vitD('boy_16_18', 'rda', 600, 13),
  ...row('girl_16_18', 'ai', 'fibre_g', 38, 13),
  ...tableRow('girl_16_18', 'rda', 13, {
    protein_g: 46.0,
    calcium_mg: 1050,
    magnesium_mg: 380,
    iron_mg: 32,
    zinc_mg: 14.2,
    iodine_ug: 140,
    thiamine_mg: 1.7,
    riboflavin_mg: 2.3,
    niacin_mg: 17,
    vit_b6_mg: 2.3,
    folate_ug: 270,
    vit_b12_ug: 2.2,
    vit_c_mg: 70,
    vit_a_ug: 860,
  }),
  ...vitD('girl_16_18', 'rda', 600, 13),

  // --- p. 15 — Elderly (≥ 60 y) ---------------------------------------------------------------
  // No category of work here. Anything not in this table is "maintained similar to adults"
  // (p. 11), so lookups fall back to the adult rows.
  ...tableRow('man_60', 'ear', 15, {
    energy_kcal: 1700,
    protein_g: 43.0,
    vit_a_ug: 460,
    thiamine_mg: 1.2,
    riboflavin_mg: 1.6,
    niacin_mg: 12,
    vit_c_mg: 65,
    vit_b6_mg: 1.6,
    folate_ug: 250,
    vit_b12_ug: 2.0,
    calcium_mg: 1000,
    magnesium_mg: 370,
    iron_mg: 11,
    zinc_mg: 14,
    iodine_ug: 95,
  }),
  ...vitD('man_60', 'ear', 400, 15),
  ...row('man_60', 'ai', 'fibre_g', 30, 15),
  ...tableRow('man_60', 'rda', 15, {
    protein_g: 54.0,
    vit_a_ug: 1000,
    thiamine_mg: 1.4,
    riboflavin_mg: 2.0,
    niacin_mg: 14,
    vit_c_mg: 80,
    vit_b6_mg: 1.9,
    folate_ug: 300,
    vit_b12_ug: 2.2,
    calcium_mg: 1200,
    magnesium_mg: 440,
    iron_mg: 19,
    zinc_mg: 17,
    iodine_ug: 140,
  }),
  ...vitD('man_60', 'rda', 800, 15),
  ...tableRow('woman_60', 'ear', 15, {
    energy_kcal: 1500,
    protein_g: 36.3,
    vit_a_ug: 390,
    thiamine_mg: 1.1,
    riboflavin_mg: 1.6,
    niacin_mg: 9,
    vit_c_mg: 55,
    vit_b6_mg: 1.6,
    folate_ug: 180,
    vit_b12_ug: 2.0,
    calcium_mg: 1000,
    magnesium_mg: 310,
    iron_mg: 11,
    zinc_mg: 11,
    iodine_ug: 95,
  }),
  ...vitD('woman_60', 'ear', 400, 15),
  ...row('woman_60', 'ai', 'fibre_g', 25, 15),
  ...tableRow('woman_60', 'rda', 15, {
    protein_g: 46.0,
    vit_a_ug: 840,
    thiamine_mg: 1.4,
    riboflavin_mg: 1.9,
    niacin_mg: 11,
    vit_c_mg: 65,
    vit_b6_mg: 1.9,
    folate_ug: 200,
    vit_b12_ug: 2.2,
    calcium_mg: 1200,
    magnesium_mg: 370,
    iron_mg: 19,
    zinc_mg: 13.2,
    iodine_ug: 140,
  }),
  ...vitD('woman_60', 'rda', 800, 15),

  // --- p. 16 — Other minerals and trace elements in adults (recommended intake per day) --------
  // Sodium's 2000 mg is a safe upper intake (p. 6: "a safe intake of 2000 mg/day which amounts to
  // 5 g/day of salt"), so it is stored as the adult TUL, the limit the sodium alert uses.
  ...(['man', 'woman'] as const).flatMap((group) => [
    ...row(group, 'rda', 'phosphorus_mg', 1000, 16),
    ...row(group, 'tul', 'sodium_mg', 2000, 16, 'safe intake ≈ 5 g salt (p. 6)'),
    ...row(group, 'ai', 'potassium_mg', 3500, 16),
    ...row(group, 'ai', 'copper_mg', 1.7, 16),
    ...row(group, 'ai', 'manganese_mg', 4, 16),
    ...row(group, 'ai', 'selenium_ug', 40, 16, '"adequate intake" (p. 7)'),
  ]),

  // --- Text, adults (pp. 7–10) -----------------------------------------------------------------
  ...(['man', 'woman'] as const).flatMap((group) => [
    ...row(group, 'ai', 'pantothenic_mg', 5, 8),
    ...row(group, 'ai', 'biotin_ug', 40, 9),
    ...row(group, 'ai', 'vit_e_mg', 10, 10, 'text gives "roughly 7.5–10 mg"; upper end used'),
    ...row(group, 'ai', 'vit_k_ug', 55, 10),
  ]),
  ...(['boy_16_18', 'girl_16_18'] as const).flatMap((group) => [
    ...row(group, 'ai', 'pantothenic_mg', 5, 8, 'adolescents'),
    ...row(group, 'ai', 'biotin_ug', 35, 9, 'adolescents'),
  ]),

  // --- p. 17 — Tolerable upper limits -----------------------------------------------------------
  // Same for men and women (all categories of work). Magnesium's TUL is for supplements only.
  ...(['man', 'woman'] as const).flatMap((group) => [
    ...tableRow(group, 'tul', 17, {
      calcium_mg: 2500,
      iron_mg: 45,
      zinc_mg: 40,
      iodine_ug: 1100,
      niacin_mg: 35,
      vit_b6_mg: 100,
      folate_ug: 1000,
      vit_c_mg: 2000,
      vit_a_ug: 3000,
    }),
    ...row(group, 'tul', 'magnesium_mg', 350, 17, 'from supplements only, not food'),
    ...vitD(group, 'tul', 4000, 17),
  ]),
  ...(['boy_16_18', 'girl_16_18'] as const).flatMap((group) => [
    ...tableRow(group, 'tul', 17, {
      calcium_mg: 3000,
      iron_mg: 45,
      zinc_mg: 34,
      iodine_ug: 1100,
      vit_a_ug: 2800,
    }),
    ...row(group, 'tul', 'folate_ug', 600, 17, 'printed as 600–800; lower end used'),
    ...row(group, 'tul', 'magnesium_mg', 350, 17, 'from supplements only, not food'),
    ...vitD(group, 'tul', 4000, 17),
  ]),
  ...row('boy_16_18', 'tul', 'vit_c_mg', 1950, 17),
  ...row('girl_16_18', 'tul', 'vit_c_mg', 2000, 17),
];

/**
 * Where to look when a group's own table has no value for a nutrient: the elderly keep the adult
 * values (p. 11); 16–18-year-olds use the adult ones for what only the adult tables list
 * (p. 16 minerals, vitamins E and K).
 */
const FALLBACK: Partial<Record<IcmrGroup, IcmrGroup>> = {
  man_60: 'man',
  woman_60: 'woman',
  boy_16_18: 'man',
  girl_16_18: 'woman',
};

/** Other daily figures from the report used by Kalorie's target maths. */
export const ICMR_GUIDES = {
  /** Safe protein intake for adults, g per kg body weight per day (p. 4). */
  proteinGPerKg: { value: 0.83, page: 4 },
  /** Fibre: "about 30 g / 2000 kcal" (p. 5). */
  fibreGPer1000Kcal: { value: 15, page: 5 },
  /** Adults' total fat, % of energy (AMDR, p. 16). */
  fatPctEnergy: { min: 15, max: 35, page: 16 },
  /** Adults' carbohydrate, % of energy (AMDR, p. 16). */
  carbPctEnergy: { min: 45, max: 65, page: 16 },
  /** Minimum carbohydrate for everyone 1 y and older, g/day (p. 5). */
  carbMinG: { value: 130, page: 5 },
} as const;

// --- Lookups --------------------------------------------------------------------------------

export type Sex = 'm' | 'f' | 'x';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

/** ICMR group for an adult's age and sex, or `null` under 18 (no targets, SPEC §1). */
export function icmrGroup(age: number, sex: 'm' | 'f'): IcmrGroup | null {
  if (age < 18) return null;
  if (age < 19) return sex === 'm' ? 'boy_16_18' : 'girl_16_18';
  if (age < 60) return sex === 'm' ? 'man' : 'woman';
  return sex === 'm' ? 'man_60' : 'woman_60';
}

/**
 * Kalorie's 5 activity levels → ICMR's 3 categories of work. ICMR's levels follow FAO/WHO/UNU
 * 2004 (p. 3–4): sedentary/light lifestyles, active/moderately active, and vigorous.
 */
export function icmrActivity(activity: ActivityLevel): IcmrActivity {
  switch (activity) {
    case 'sedentary':
    case 'light':
      return 'sedentary';
    case 'moderate':
    case 'active':
      return 'moderate';
    case 'very_active':
      return 'heavy';
  }
}

/** One group's value (with fallback to the adult rows), or `null` if the report has none. */
export function icmrRow(
  group: IcmrGroup,
  nutrient: IcmrNutrient,
  kind: IcmrKind,
  activity: IcmrActivity = 'sedentary',
): IcmrRow | null {
  const rows = ICMR_ROWS.filter(
    (r) => r.group === group && r.nutrient === nutrient && r.kind === kind,
  );
  const match =
    rows.find((r) => r.activity === activity) ?? rows.find((r) => r.activity === undefined);
  if (match) return match;
  const fallback = FALLBACK[group];
  return fallback ? icmrRow(fallback, nutrient, kind, activity) : null;
}

export interface Requirement {
  /** Daily amount to aim for: the RDA, or the adequate intake where there is no RDA. */
  need: number | null;
  ear: number | null;
  /** Safe upper limit; `null` = the report gives none. */
  tul: number | null;
}

/**
 * A person's requirement for one nutrient. "Prefer not to say" (`x`) uses the higher need of
 * men and women and the lower upper limit (SPEC §3.1). `null` under 18.
 */
export function requirement(
  nutrient: IcmrNutrient,
  sex: Sex,
  age: number,
  activity: ActivityLevel = 'sedentary',
): Requirement | null {
  if (sex === 'x') {
    const m = requirement(nutrient, 'm', age, activity);
    const f = requirement(nutrient, 'f', age, activity);
    if (!m || !f) return null;
    return {
      need: pick(Math.max, m.need, f.need),
      ear: pick(Math.max, m.ear, f.ear),
      tul: pick(Math.min, m.tul, f.tul),
    };
  }
  const group = icmrGroup(age, sex);
  if (!group) return null;
  const level = icmrActivity(activity);
  const value = (kind: IcmrKind) => icmrRow(group, nutrient, kind, level)?.value ?? null;
  return { need: value('rda') ?? value('ai'), ear: value('ear'), tul: value('tul') };
}

function pick(
  choose: (a: number, b: number) => number,
  a: number | null,
  b: number | null,
): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return choose(a, b);
}

/** The vitamins and minerals a person's micronutrient targets cover (SPEC §3 groups). */
export const MICRO_NUTRIENTS: readonly IcmrNutrient[] = [
  'sodium_mg',
  'potassium_mg',
  'calcium_mg',
  'iron_mg',
  'magnesium_mg',
  'phosphorus_mg',
  'zinc_mg',
  'copper_mg',
  'manganese_mg',
  'selenium_ug',
  'iodine_ug',
  'vit_a_ug',
  'thiamine_mg',
  'riboflavin_mg',
  'niacin_mg',
  'pantothenic_mg',
  'vit_b6_mg',
  'biotin_ug',
  'folate_ug',
  'vit_b12_ug',
  'vit_c_mg',
  'vit_d_ug',
  'vit_e_mg',
  'vit_k_ug',
];

/** Every vitamin and mineral requirement for one person, or `null` under 18. */
export function microRequirements(
  sex: Sex,
  age: number,
  activity: ActivityLevel = 'sedentary',
): Partial<Record<IcmrNutrient, Requirement>> | null {
  if (age < 18) return null;
  const result: Partial<Record<IcmrNutrient, Requirement>> = {};
  for (const nutrient of MICRO_NUTRIENTS) {
    const req = requirement(nutrient, sex, age, activity);
    if (req) result[nutrient] = req;
  }
  return result;
}
