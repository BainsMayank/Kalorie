import { create } from 'zustand';

import {
  EMPTY_ANSWERS,
  deleteWeight,
  getProfile,
  listTargets,
  listWeights,
  saveProfile,
  saveTargets,
  saveWeight,
  targetsFromRow,
  type ProfileAnswers,
} from '@/db/user/goals';
import type { Profile, TargetsRow, WeightRow } from '@/db/user/schema';
import { logicalDay } from '@/lib/day';
import { ageFromBirthYear } from '@/lib/measure';
import { rowForDay, type BodyProfile, type TargetValues } from '@/lib/targets';

// The database is the source of truth. This store keeps the profile, every weigh-in and every
// targets row in memory so screens can read them instantly (SPEC §4.2). One weigh-in a day at
// most, so even years of them are a short list.

type GoalsState = {
  loaded: boolean;
  profile: Profile | null;
  /** The latest weigh-in's kg (the targets use it). */
  weightKg: number | null;
  /** Every weigh-in, oldest first. */
  weighIns: WeightRow[];
  /** Oldest first. */
  targetRows: TargetsRow[];
  load: () => Promise<void>;
  /**
   * Saves the onboarding answers, the weight (as today's weigh-in) and the first targets, and
   * marks onboarding done.
   */
  finishOnboarding: (
    answers: ProfileAnswers,
    weightKg: number | null,
    targets: TargetValues,
  ) => Promise<void>;
  /** Saves profile answers and the weight from Goals; targets stay as they are. */
  saveAbout: (answers: ProfileAnswers, weightKg: number | null) => Promise<void>;
  /** Saves targets from today on (past days keep theirs). */
  saveTargets: (values: TargetValues, isCustom: boolean) => Promise<void>;
  /** Saves a weigh-in for a day (one the same day replaces it). */
  saveWeighIn: (day: string, weightKg: number) => Promise<void>;
  /** Deletes a day's weigh-in. */
  deleteWeighIn: (day: string) => Promise<void>;
};

/** The weigh-ins, and the latest one's kg. */
async function readWeights(): Promise<{ weighIns: WeightRow[]; weightKg: number | null }> {
  const weighIns = await listWeights();
  return { weighIns, weightKg: weighIns[weighIns.length - 1]?.weightKg ?? null };
}

/** The profile as the target formulas need it. */
export function bodyProfile(
  answers: ProfileAnswers | null,
  weightKg: number | null,
  now = Date.now(),
): BodyProfile {
  const a = answers ?? EMPTY_ANSWERS;
  return {
    sex: a.sex,
    age: a.birthYear === null ? null : ageFromBirthYear(a.birthYear, now),
    heightCm: a.heightCm,
    weightKg,
    activity: a.activity,
    goal: a.goal,
    paceKgWeek: a.paceKgWeek,
  };
}

export const useGoalsStore = create<GoalsState>()((set, get) => ({
  loaded: false,
  profile: null,
  weightKg: null,
  weighIns: [],
  targetRows: [],

  load: async () => {
    const [profile, weights, targetRows] = await Promise.all([
      getProfile(),
      readWeights(),
      listTargets(),
    ]);
    set({ profile, ...weights, targetRows, loaded: true });
  },

  finishOnboarding: async (answers, weightKg, targets) => {
    const now = Date.now();
    const today = logicalDay(now);
    const profile = await saveProfile(answers, now, now);
    if (weightKg !== null) await saveWeight(today, weightKg, now);
    await saveTargets(today, targets, false, now);
    set({ profile, ...(await readWeights()), targetRows: await listTargets() });
  },

  saveAbout: async (answers, weightKg) => {
    const now = Date.now();
    const profile = await saveProfile(answers, now, now);
    if (weightKg !== null && weightKg !== get().weightKg) {
      await saveWeight(logicalDay(now), weightKg, now);
    }
    set({ profile, ...(await readWeights()) });
  },

  saveTargets: async (values, isCustom) => {
    await saveTargets(logicalDay(Date.now()), values, isCustom);
    set({ targetRows: await listTargets() });
  },

  saveWeighIn: async (day, weightKg) => {
    await saveWeight(day, weightKg);
    set(await readWeights());
  },

  deleteWeighIn: async (day) => {
    await deleteWeight(day);
    set(await readWeights());
  },
}));

/** The targets in effect on `day`, or `null` before any were saved. */
export function targetsOnDay(rows: readonly TargetsRow[], day: string): TargetValues | null {
  const row = rowForDay(rows, day);
  return row ? targetsFromRow(row) : null;
}
