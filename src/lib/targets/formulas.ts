// Starting targets (SPEC §5.4): Mifflin-St Jeor BMR × activity factor, moved by the goal's pace,
// then split into macros (SPEC §1: 55% carbs / 15% protein / 30% fat, protein ≥ 0.83 g/kg) and
// the four daily limits (SPEC §6). Fibre and vitamins/minerals come from ICMR-NIN 2020 (icmr.ts).

import { ICMR_GUIDES, requirement, type ActivityLevel, type Sex } from './icmr';

export type Goal = 'lose' | 'maintain' | 'gain' | 'track';

export const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];

/** Mifflin-St Jeor activity factors. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** The sex term of Mifflin-St Jeor; "prefer not to say" sits halfway between (SPEC §5.4). */
const SEX_TERM: Record<Sex, number> = { m: 5, f: -161, x: -78 };

/** The lowest daily calorie target we'd suggest (SPEC §1): 1500 men, 1200 women / not stated. */
const SEX_FLOOR: Record<Sex, number> = { m: 1500, f: 1200, x: 1200 };

/** 1 kg of body weight ≈ 7700 kcal. */
export const KCAL_PER_KG = 7700;

/** Paces offered for each goal, in kg per week (SPEC §2.1). */
export const PACES: Record<Goal, readonly number[]> = {
  lose: [0.25, 0.5],
  gain: [0.25],
  maintain: [0],
  track: [0],
};

/** Percentage limits in Just-track mode (no calorie target) use this base (SPEC §6). */
export const TRACK_BASE_KCAL = 2000;

/** Adults only (SPEC §1). */
export const ADULT_AGE = 18;

/** Basal metabolic rate, kcal/day (Mifflin-St Jeor). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_TERM[sex];
}

/** Total daily energy expenditure: BMR × activity factor. */
export function tdee(bmrKcal: number, activity: ActivityLevel): number {
  return bmrKcal * ACTIVITY_FACTORS[activity];
}

/** Daily calories to move `paceKgWeek`: 0.25 → 275 kcal, 0.5 → 550 kcal. */
export function paceDelta(paceKgWeek: number): number {
  return (paceKgWeek * KCAL_PER_KG) / 7;
}

/** Rounds calories to the nearest 50. */
export function roundKcal(kcal: number): number {
  return Math.round(kcal / 50) * 50;
}

/**
 * The safe floor: never below the sex floor, never below BMR (SPEC §5.4). `bmrKcal` is `null`
 * when the body numbers are unknown; then only the sex floor applies.
 */
export function safeFloor(sex: Sex, bmrKcal: number | null): number {
  return Math.max(SEX_FLOOR[sex], bmrKcal ?? 0);
}

/** The number we suggest instead of a target under the floor: the floor, rounded up to 50. */
export function floorSuggestion(floor: number): number {
  return Math.ceil(floor / 50) * 50;
}

export interface MacroTargets {
  protein_g: number;
  carb_g: number;
  fat_g: number;
}

/**
 * Macro grams for a calorie target (SPEC §5.4): protein 15% of kcal but at least 0.83 g per kg
 * (ICMR-NIN p. 4), fat 30%, carbs whatever is left (carbs absorb any extra protein). Whole grams.
 */
export function macroTargets(kcal: number, weightKg: number | null): MacroTargets {
  const protein = Math.max((kcal * 0.15) / 4, ICMR_GUIDES.proteinGPerKg.value * (weightKg ?? 0));
  const fat = (kcal * 0.3) / 9;
  const carb = Math.max(0, (kcal - 4 * protein - 9 * fat) / 4);
  return { protein_g: Math.round(protein), carb_g: Math.round(carb), fat_g: Math.round(fat) };
}

/** The four daily limits alerts watch (SPEC §6). */
export interface Limits {
  sodium_mg: number;
  sugar_g: number;
  sat_fat_g: number;
  fat_g: number;
}

/**
 * Default limits: sodium 2000 mg (ICMR-NIN p. 16), total sugar 10% of kcal, saturated fat 10%,
 * total fat 30%. Without a calorie target the percentages use 2000 kcal. Whole numbers.
 */
export function defaultLimits(kcal: number | null): Limits {
  const base = kcal ?? TRACK_BASE_KCAL;
  return {
    sodium_mg: 2000,
    sugar_g: Math.round((base * 0.1) / 4),
    sat_fat_g: Math.round((base * 0.1) / 9),
    fat_g: Math.round((base * 0.3) / 9),
  };
}

/** What a person told us. Every answer can be skipped, so every field may be `null`. */
export interface BodyProfile {
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: ActivityLevel | null;
  goal: Goal | null;
  paceKgWeek: number | null;
}

/** One day's targets, as stored in the `targets` table (SPEC §4.2). */
export interface TargetValues {
  /** `null` = no calorie target (Just track, under 18, or body numbers missing). */
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  sodium_mg_limit: number;
  sugar_g_limit: number;
  sat_fat_g_limit: number;
  fat_g_limit: number;
}

/** Why there is no calorie target. */
export type NoKcalReason = 'track' | 'under18' | 'missing';

export interface Suggestion {
  targets: TargetValues;
  bmr: number | null;
  tdee: number | null;
  /** `null` when there is no calorie target. */
  noKcalReason: NoKcalReason | null;
  /** Body numbers still needed for a calorie target. */
  missing: ('age' | 'height' | 'weight')[];
}

/** Answers that were skipped fall back to these for the maths (never stored). */
export const ASSUMED = { sex: 'x' as Sex, activity: 'sedentary' as ActivityLevel, age: 30 };

/** The goal actually used: Just track under 18, maintain when the question was skipped. */
export function effectiveGoal(profile: Pick<BodyProfile, 'goal' | 'age'>): Goal {
  if (profile.age !== null && profile.age < ADULT_AGE) return 'track';
  return profile.goal ?? 'maintain';
}

/** Fibre for a person: ICMR-NIN adequate intake by sex, age and activity (p. 13 / p. 15). */
export function fibreTarget(profile: Pick<BodyProfile, 'sex' | 'age' | 'activity'>): number | null {
  const age = profile.age ?? ASSUMED.age;
  const req = requirement(
    'fibre_g',
    profile.sex ?? ASSUMED.sex,
    age,
    profile.activity ?? ASSUMED.activity,
  );
  return req?.need ?? null;
}

/** The daily calorie target for a profile, unrounded parts included (SPEC §5.4). */
export function suggestTargets(profile: BodyProfile): Suggestion {
  const sex = profile.sex ?? ASSUMED.sex;
  const activity = profile.activity ?? ASSUMED.activity;
  const goal = effectiveGoal(profile);
  const missing: Suggestion['missing'] = [];
  if (profile.age === null) missing.push('age');
  if (profile.heightCm === null) missing.push('height');
  if (profile.weightKg === null) missing.push('weight');

  const bmrKcal =
    missing.length === 0 ? bmr(sex, profile.weightKg!, profile.heightCm!, profile.age!) : null;
  const tdeeKcal = bmrKcal === null ? null : tdee(bmrKcal, activity);

  let noKcalReason: NoKcalReason | null = null;
  if (profile.age !== null && profile.age < ADULT_AGE) noKcalReason = 'under18';
  else if (goal === 'track') noKcalReason = 'track';
  else if (tdeeKcal === null) noKcalReason = 'missing';

  let kcal: number | null = null;
  if (noKcalReason === null && tdeeKcal !== null) {
    const pace = profile.paceKgWeek ?? PACES[goal][0];
    const delta = goal === 'lose' ? -paceDelta(pace) : goal === 'gain' ? paceDelta(pace) : 0;
    kcal = roundKcal(tdeeKcal + delta);
  }

  return {
    targets: targetsForKcal(kcal, profile),
    bmr: bmrKcal,
    tdee: tdeeKcal,
    noKcalReason,
    missing,
  };
}

/**
 * Macros, fibre and limits that go with a calorie target. Also used when the person types their
 * own calorie number in Goals, so the rest follows it.
 */
export function targetsForKcal(
  kcal: number | null,
  profile: Pick<BodyProfile, 'sex' | 'age' | 'activity' | 'weightKg'>,
): TargetValues {
  const macros = kcal === null ? null : macroTargets(kcal, profile.weightKg);
  const limits = defaultLimits(kcal);
  const under18 = profile.age !== null && profile.age < ADULT_AGE;
  return {
    kcal,
    protein_g: macros?.protein_g ?? null,
    carb_g: macros?.carb_g ?? null,
    fat_g: macros?.fat_g ?? null,
    fibre_g: under18 ? null : fibreTarget(profile),
    sodium_mg_limit: limits.sodium_mg,
    sugar_g_limit: limits.sugar_g,
    sat_fat_g_limit: limits.sat_fat_g,
    fat_g_limit: limits.fat_g,
  };
}

export interface FloorCheck {
  floor: number;
  /** What we'd suggest instead (the floor rounded up to 50). */
  suggestion: number;
  below: boolean;
}

/**
 * Is a calorie target below the safe floor? `null` when there is no target. Warn, never block
 * (SPEC §6 rule 6).
 */
export function checkFloor(
  kcal: number | null,
  profile: Pick<BodyProfile, 'sex' | 'age' | 'heightCm' | 'weightKg'>,
): FloorCheck | null {
  if (kcal === null) return null;
  const sex = profile.sex ?? ASSUMED.sex;
  const known = profile.age !== null && profile.heightCm !== null && profile.weightKg !== null;
  const bmrKcal = known ? bmr(sex, profile.weightKg!, profile.heightCm!, profile.age!) : null;
  const floor = safeFloor(sex, bmrKcal);
  return { floor, suggestion: floorSuggestion(floor), below: kcal < floor };
}
