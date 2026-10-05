// The "About you" answers while they are being edited (onboarding and Goals), and how they
// become a saved profile. Numbers are kept as typed text until saved.

import type { ProfileAnswers } from '@/db/user/goals';
import type { Profile } from '@/db/user/schema';
import { formatQty } from '@/lib/format';
import { ageFromBirthYear, BODY_RANGES, birthYearFromAge, inRange } from '@/lib/measure';
import { parseAmount } from '@/lib/parse';
import {
  ADULT_AGE,
  PACES,
  type ActivityLevel,
  type BodyProfile,
  type Goal,
  type Sex,
} from '@/lib/targets';

export interface AboutDraft {
  sex: Sex | null;
  age: string;
  heightCm: number | null;
  weight: string;
  activity: ActivityLevel | null;
  goal: Goal | null;
  pace: number | null;
}

export const EMPTY_DRAFT: AboutDraft = {
  sex: null,
  age: '',
  heightCm: null,
  weight: '',
  activity: null,
  goal: null,
  pace: null,
};

/** The saved profile and weight, ready to edit. */
export function draftFromProfile(
  profile: Profile | null,
  weightKg: number | null,
  now = Date.now(),
): AboutDraft {
  if (!profile) return { ...EMPTY_DRAFT, weight: weightKg === null ? '' : formatQty(weightKg) };
  return {
    sex: profile.sex,
    age: profile.birthYear === null ? '' : String(ageFromBirthYear(profile.birthYear, now)),
    heightCm: profile.heightCm,
    weight: weightKg === null ? '' : formatQty(weightKg),
    activity: profile.activity,
    goal: profile.goal,
    pace: profile.paceKgWeek,
  };
}

/** A typed age as a whole number, or `null` if empty or not believable. */
export function draftAge(draft: AboutDraft): number | null {
  const age = parseAmount(draft.age);
  return inRange(age === null ? null : Math.round(age), BODY_RANGES.age);
}

/** A typed weight in kg, or `null` if empty or not believable. */
export function draftWeight(draft: AboutDraft): number | null {
  return inRange(parseAmount(draft.weight), BODY_RANGES.weightKg);
}

/** Under 18: logging only, no targets (SPEC §1). */
export function isUnder18(draft: AboutDraft): boolean {
  const age = draftAge(draft);
  return age !== null && age < ADULT_AGE;
}

/**
 * What gets saved. Under 18 the goal becomes Just track (SPEC §2.1); a pace is kept only for
 * a goal that has one, and a pace that isn't offered for the goal falls back to the first one.
 */
export function answersFromDraft(
  draft: AboutDraft,
  now = Date.now(),
): { answers: ProfileAnswers; weightKg: number | null } {
  const age = draftAge(draft);
  const goal: Goal | null = isUnder18(draft) ? 'track' : draft.goal;
  let pace: number | null = null;
  if (goal !== null) {
    const offered = PACES[goal];
    pace = draft.pace !== null && offered.includes(draft.pace) ? draft.pace : offered[0];
  }
  return {
    answers: {
      sex: draft.sex,
      birthYear: age === null ? null : birthYearFromAge(age, now),
      heightCm: inRange(draft.heightCm, BODY_RANGES.heightCm),
      activity: draft.activity,
      goal,
      paceKgWeek: pace,
    },
    weightKg: draftWeight(draft),
  };
}

/** The draft as the target formulas need it. */
export function bodyFromDraft(draft: AboutDraft, now = Date.now()): BodyProfile {
  const { answers, weightKg } = answersFromDraft(draft, now);
  return {
    sex: answers.sex,
    age: draftAge(draft),
    heightCm: answers.heightCm,
    weightKg,
    activity: answers.activity,
    goal: answers.goal,
    paceKgWeek: answers.paceKgWeek,
  };
}
