// The person's profile, their targets over time and their weigh-ins (SPEC §4.2).

import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import type { TargetValues } from '@/lib/targets';
import { uuid } from '@/lib/uuid';

import { getUserDb } from './client';
import { profile, targets, weights, type Profile, type TargetsRow, type WeightRow } from './schema';

const PROFILE_ID = 1;

/** The profile's answers (without the id and timestamps). */
export type ProfileAnswers = Omit<Profile, 'id' | 'onboardedAt' | 'updatedAt'>;

export const EMPTY_ANSWERS: ProfileAnswers = {
  sex: null,
  birthYear: null,
  heightCm: null,
  activity: null,
  goal: null,
  paceKgWeek: null,
};

/** The profile, or `null` before onboarding has saved anything. */
export async function getProfile(): Promise<Profile | null> {
  const [row] = await getUserDb().select().from(profile).where(eq(profile.id, PROFILE_ID));
  return row ?? null;
}

/** Saves the profile's answers (insert or replace). `onboardedAt` is kept once set. */
export async function saveProfile(
  answers: ProfileAnswers,
  onboardedAt: number | null,
  now = Date.now(),
): Promise<Profile> {
  const existing = await getProfile();
  const row: Profile = {
    id: PROFILE_ID,
    ...answers,
    onboardedAt: existing?.onboardedAt ?? onboardedAt,
    updatedAt: now,
  };
  await getUserDb()
    .insert(profile)
    .values(row)
    .onConflictDoUpdate({ target: profile.id, set: row });
  return row;
}

/** Every targets row that isn't deleted, oldest first. */
export async function listTargets(): Promise<TargetsRow[]> {
  return getUserDb()
    .select()
    .from(targets)
    .where(isNull(targets.deletedAt))
    .orderBy(asc(targets.effectiveFrom));
}

/** Database columns ↔ the formulas' names. */
export function targetsFromRow(row: TargetsRow): TargetValues {
  return {
    kcal: row.kcal,
    protein_g: row.proteinG,
    carb_g: row.carbG,
    fat_g: row.fatG,
    fibre_g: row.fibreG,
    sodium_mg_limit: row.sodiumMgLimit,
    sugar_g_limit: row.sugarGLimit,
    sat_fat_g_limit: row.satFatGLimit,
    fat_g_limit: row.fatGLimit,
  };
}

/**
 * Saves targets starting on `day`. Saving again on the same day replaces that day's row, so
 * there is one row per day and earlier days keep their targets.
 */
export async function saveTargets(
  day: string,
  values: TargetValues,
  isCustom: boolean,
  now = Date.now(),
): Promise<TargetsRow> {
  const columns = {
    kcal: values.kcal,
    proteinG: values.protein_g,
    carbG: values.carb_g,
    fatG: values.fat_g,
    fibreG: values.fibre_g,
    sodiumMgLimit: values.sodium_mg_limit,
    sugarGLimit: values.sugar_g_limit,
    satFatGLimit: values.sat_fat_g_limit,
    fatGLimit: values.fat_g_limit,
    isCustom,
    updatedAt: now,
    deletedAt: null,
  };
  const row: TargetsRow = { id: uuid(), effectiveFrom: day, createdAt: now, ...columns };
  await getUserDb()
    .insert(targets)
    .values(row)
    .onConflictDoUpdate({ target: targets.effectiveFrom, set: columns });
  const [saved] = await getUserDb().select().from(targets).where(eq(targets.effectiveFrom, day));
  return saved;
}

/** The latest weigh-in in kg, or `null` if there is none. */
export async function latestWeight(): Promise<number | null> {
  const [row] = await getUserDb()
    .select({ weightKg: weights.weightKg })
    .from(weights)
    .where(isNull(weights.deletedAt))
    .orderBy(desc(weights.day), desc(weights.loggedAt))
    .limit(1);
  return row?.weightKg ?? null;
}

/** Saves a weigh-in; one the same day replaces it (SPEC §4.2). */
export async function saveWeight(day: string, weightKg: number, now = Date.now()): Promise<void> {
  const db = getUserDb();
  const [existing] = await db
    .select({ id: weights.id })
    .from(weights)
    .where(and(eq(weights.day, day), isNull(weights.deletedAt)));
  if (existing) {
    await db
      .update(weights)
      .set({ weightKg, loggedAt: now, updatedAt: now })
      .where(eq(weights.id, existing.id));
    return;
  }
  await db.insert(weights).values({
    id: uuid(),
    day,
    weightKg,
    loggedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

/** Every weigh-in that isn't deleted, oldest first. */
export async function listWeights(): Promise<WeightRow[]> {
  return getUserDb()
    .select()
    .from(weights)
    .where(isNull(weights.deletedAt))
    .orderBy(asc(weights.day));
}

/** Deletes a day's weigh-in (soft delete). */
export async function deleteWeight(day: string, now = Date.now()): Promise<void> {
  await getUserDb()
    .update(weights)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(weights.day, day), isNull(weights.deletedAt)));
}
