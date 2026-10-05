// Days added up for the calendar and Trends (SPEC §2.10, §2.11). Totals are always worked out
// from the entries (SPEC §5.3), never stored.

import { adherence, type Adherence } from './adherence';
import { addDays } from './day';
import type { NutrientValues } from './nutrients';

/** What one day adds up to. */
export interface DayTotals {
  /** Entries that aren't deleted (quick adds count). */
  entryCount: number;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
}

/** The four numbers Trends averages. */
export const TREND_NUTRIENTS = ['kcal', 'protein_g', 'carb_g', 'fat_g'] as const;
export type TrendNutrient = (typeof TREND_NUTRIENTS)[number];

/**
 * Each day's totals, from its entries' nutrients. Unknown values count as none, so a day always
 * has a number. Days with no entries are simply missing from the map.
 */
export function totalsByDay(
  entries: readonly { day: string; nutrients: NutrientValues }[],
): Map<string, DayTotals> {
  const result = new Map<string, DayTotals>();
  for (const { day, nutrients } of entries) {
    let totals = result.get(day);
    if (!totals) {
      totals = { entryCount: 0, kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };
      result.set(day, totals);
    }
    totals.entryCount += 1;
    totals.kcal += nutrients.energy_kcal ?? 0;
    totals.protein_g += nutrients.protein_g ?? 0;
    totals.carb_g += nutrients.carb_g ?? 0;
    totals.fat_g += nutrients.fat_g ?? 0;
  }
  return result;
}

/** The `length` days ending on `lastDay`, oldest first (a week: 7, a month: 30). */
export function periodDays(lastDay: string, length: number): string[] {
  return Array.from({ length }, (_, i) => addDays(lastDay, i - length + 1));
}

/** First and last day of the month that `day` is in. */
export function monthRange(day: string): { from: string; to: string } {
  const [year, month] = day.split('-').map(Number);
  const last = new Date(year, month, 0).getDate(); // day 0 of next month = last of this one
  const mm = String(month).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` };
}

/** A day's targets, as far as Trends needs them. `null` = no target. */
export type DayTrendTargets = Record<TrendNutrient, number | null>;

/** A period's averages (SPEC §2.11: "average 1,840 kcal · 5 days on track"). */
export interface PeriodStats {
  /** Days counted in the averages, oldest first. */
  counted: string[];
  /** How many there are. */
  countedDays: number;
  /** Days within ±10% of their calorie target. */
  onTargetDays: number;
  /** Average per counted day; `null` when no day counts yet. */
  average: Record<TrendNutrient, number | null>;
  /** Average of the counted days' targets; `null` if those days had none. */
  averageTarget: Record<TrendNutrient, number | null>;
  /** Each day's colour (days after today are left out). */
  adherence: Map<string, Adherence>;
}

/**
 * Averages over a period. Only days with something logged count (a missed day isn't a
 * zero-calorie day), and today counts only once it looks finished: while it is partly logged
 * or still under target it would pull the average down.
 */
export function periodStats(
  days: readonly string[],
  totals: ReadonlyMap<string, DayTotals>,
  targetsFor: (day: string) => DayTrendTargets | null,
  today: string,
): PeriodStats {
  const sums = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };
  const targetSums = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };
  const targetDays = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };
  const colours = new Map<string, Adherence>();
  const counted: string[] = [];
  let onTargetDays = 0;

  for (const day of days) {
    if (day > today) continue;
    const found = totals.get(day);
    const targets = targetsFor(day);
    const colour = adherence({
      entryCount: found?.entryCount ?? 0,
      kcal: found?.kcal ?? 0,
      targetKcal: targets?.kcal ?? null,
      inProgress: day === today,
    });
    colours.set(day, colour);
    if (colour === 'onTarget') onTargetDays += 1;
    if (!found || colour === 'empty' || (day === today && colour === 'partial')) continue;

    counted.push(day);
    for (const key of TREND_NUTRIENTS) {
      sums[key] += found[key];
      const target = targets?.[key] ?? null;
      if (target !== null) {
        targetSums[key] += target;
        targetDays[key] += 1;
      }
    }
  }

  const average = {} as Record<TrendNutrient, number | null>;
  const averageTarget = {} as Record<TrendNutrient, number | null>;
  const countedDays = counted.length;
  for (const key of TREND_NUTRIENTS) {
    average[key] = countedDays > 0 ? sums[key] / countedDays : null;
    averageTarget[key] = targetDays[key] > 0 ? targetSums[key] / targetDays[key] : null;
  }
  return { counted, countedDays, onTargetDays, average, averageTarget, adherence: colours };
}

/** Each day's water in ml, from its water logs. */
export function waterByDay(logs: readonly { day: string; ml: number }[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const { day, ml } of logs) result.set(day, (result.get(day) ?? 0) + ml);
  return result;
}

/** Average ml per day over the days that had any water logged; `null` if none did. */
export function averageWater(days: readonly string[], ml: ReadonlyMap<string, number>) {
  const logged = days.map((d) => ml.get(d) ?? 0).filter((v) => v > 0);
  return logged.length > 0 ? logged.reduce((a, b) => a + b, 0) / logged.length : null;
}
