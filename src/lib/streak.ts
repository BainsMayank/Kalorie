// The forgiving streak (SPEC §5.7). A day counts when anything at all was logged (one meal, one
// quick add — partial days count). Weeks run Monday–Sunday and each week has 2 free days, so a
// busy day or two never ends the streak; only a 3rd missed day in the same week does. Today never
// counts against it: until something is logged today, the streak is judged up to yesterday.

import { addDays, weekday } from './day';

/** Missed days a week that don't end the streak. */
export const FREE_DAYS_PER_WEEK = 2;

/** The Monday of the week `day` is in (weeks run Monday–Sunday). */
export function weekStart(day: string): string {
  return addDays(day, -((weekday(day) + 6) % 7));
}

export interface Streak {
  /** Logged days in the unbroken run; 0 = no streak yet (or a fresh start). */
  days: number;
  /** Free days not used yet this week (Monday–Sunday), 0–2. */
  freeDaysLeft: number;
}

/**
 * The streak up to `today`, from the days that have at least one entry.
 *
 * Walks back from today (or yesterday, if nothing is logged today yet) one day at a time. Each
 * missed day uses one of its week's free days; the 3rd miss in one week ends the run. A miss only
 * belongs to the run when a logged day comes before it, so the misses that ended an older streak
 * don't use up this week's free days after a fresh start.
 */
export function forgivingStreak(logged: ReadonlySet<string>, today: string): Streak {
  const past = [...logged].filter((day) => day <= today).sort();
  const earliest = past[0];
  if (earliest === undefined) return { days: 0, freeDaysLeft: FREE_DAYS_PER_WEEK };

  const thisWeek = weekStart(today);
  const missesPerWeek = new Map<string, number>();
  let days = 0;
  let usedThisWeek = 0;
  // Misses this week not yet known to be inside the run (no logged day before them yet).
  let pendingThisWeek = 0;

  let day = logged.has(today) ? today : addDays(today, -1);
  while (day >= earliest) {
    if (logged.has(day)) {
      days += 1;
      usedThisWeek += pendingThisWeek;
      pendingThisWeek = 0;
    } else {
      const week = weekStart(day);
      const misses = (missesPerWeek.get(week) ?? 0) + 1;
      if (misses > FREE_DAYS_PER_WEEK) break;
      missesPerWeek.set(week, misses);
      if (week === thisWeek) pendingThisWeek += 1;
    }
    day = addDays(day, -1);
  }

  return { days, freeDaysLeft: Math.max(0, FREE_DAYS_PER_WEEK - usedThisWeek) };
}
