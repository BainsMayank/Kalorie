// How close a day's calories came to its target, for the calendar colours (SPEC §5.6).
//
// Calm colours only: being above a target is never an alarm, so "a bit under or over" and
// "far off" are two soft blues, and nothing is ever red.

import { addDays } from './day';

/**
 * - `empty`: nothing logged (no colour)
 * - `partial`: fewer than 3 entries, or today while it is still going and under target
 * - `logged`: logged, but there is no calorie target (Just track)
 * - `onTarget`: within ±10% of the target
 * - `near`: a bit under or over (10–25% away)
 * - `far`: more than 25% away
 */
export type Adherence = 'empty' | 'partial' | 'logged' | 'onTarget' | 'near' | 'far';

/** Within this share of the target counts as on target (SPEC §1: ±10%). */
export const ON_TARGET_SHARE = 0.1;
/** Up to this share away is "a bit under or over"; beyond it is "far off". */
export const NEAR_TARGET_SHARE = 0.25;
/** A day with fewer entries than this is only partly logged. */
export const MIN_FULL_DAY_ENTRIES = 3;

export interface AdherenceInput {
  /** Entries that day that aren't deleted (quick adds count). */
  entryCount: number;
  /** The day's calories. */
  kcal: number;
  /** The calorie target in effect that day; `null` = no target. */
  targetKcal: number | null;
  /**
   * True for today: the day isn't over, so being under target just means "not yet" — it shows
   * as partial instead of under.
   */
  inProgress?: boolean;
}

/** The calendar colour of one day (SPEC §5.6). */
export function adherence({
  entryCount,
  kcal,
  targetKcal,
  inProgress = false,
}: AdherenceInput): Adherence {
  if (entryCount <= 0) return 'empty';
  if (entryCount < MIN_FULL_DAY_ENTRIES) return 'partial';
  if (targetKcal === null || targetKcal <= 0) return 'logged';
  const away = (kcal - targetKcal) / targetKcal;
  if (inProgress && away < -ON_TARGET_SHARE) return 'partial';
  if (Math.abs(away) <= ON_TARGET_SHARE) return 'onTarget';
  if (Math.abs(away) <= NEAR_TARGET_SHARE) return 'near';
  return 'far';
}

/** A day's logged amounts, as the calendar needs them. */
export interface DayKcal {
  entryCount: number;
  kcal: number;
}

/**
 * The colour of every day from `from` to `to` (inclusive). Days with nothing logged are `empty`;
 * days after today are left out (nothing can be logged there yet).
 */
export function adherenceByDay(
  from: string,
  to: string,
  logged: ReadonlyMap<string, DayKcal>,
  targetFor: (day: string) => number | null,
  today: string,
): Map<string, Adherence> {
  const result = new Map<string, Adherence>();
  for (let day = from; day <= to && day <= today; day = addDays(day, 1)) {
    const found = logged.get(day);
    result.set(
      day,
      adherence({
        entryCount: found?.entryCount ?? 0,
        kcal: found?.kcal ?? 0,
        targetKcal: targetFor(day),
        inProgress: day === today,
      }),
    );
  }
  return result;
}

/** How many days of each colour, e.g. for "12 days logged · 7 on target". */
export function countAdherence(days: Iterable<Adherence>): Record<Adherence, number> {
  const counts: Record<Adherence, number> = {
    empty: 0,
    partial: 0,
    logged: 0,
    onTarget: 0,
    near: 0,
    far: 0,
  };
  for (const value of days) counts[value] += 1;
  return counts;
}
