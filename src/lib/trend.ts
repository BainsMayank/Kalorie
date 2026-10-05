// Weight trend (SPEC §5.7). Day-to-day weight bounces with water and food in the gut, so the
// chart draws a smooth line through the weigh-ins: an exponential moving average that moves
// 10% of the way towards each new weigh-in.

import { parseDay } from './day';

/** How far the trend moves towards each new weigh-in (SPEC §1: 10%). */
export const TREND_SMOOTHING = 0.1;

export interface WeighIn {
  day: string;
  kg: number;
}

export interface TrendPoint extends WeighIn {
  /** The smoothed weight on that day. */
  trendKg: number;
}

/**
 * The trend at every weigh-in (SPEC §5.7): the first weigh-in starts it, then each one moves it
 * `smoothing` of the way: trend_i = trend_(i−1) + 0.1 × (w_i − trend_(i−1)). One step per
 * weigh-in, in date order, however many days apart they are.
 */
export function weightTrend(
  weighIns: readonly WeighIn[],
  smoothing = TREND_SMOOTHING,
): TrendPoint[] {
  const sorted = [...weighIns].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const result: TrendPoint[] = [];
  let trend: number | null = null;
  for (const { day, kg } of sorted) {
    trend = trend === null ? kg : trend + smoothing * (kg - trend);
    result.push({ day, kg, trendKg: trend });
  }
  return result;
}

/** Whole days from `a` to `b` (negative if `b` is earlier). Safe across clock changes. */
export function daysBetween(a: string, b: string): number {
  const utc = (day: string) => {
    const { year, month, date } = parseDay(day);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/** The shortest stretch of weigh-ins a weekly change is worked out over. */
export const WEEKLY_CHANGE_MIN_DAYS = 7;

/**
 * How much the trend moved per week (kg; negative = down), from the latest weigh-in back to the
 * latest one at least a week before it. `null` until the weigh-ins span a week.
 */
export function weeklyChange(points: readonly TrendPoint[]): number | null {
  const last = points[points.length - 1];
  if (!last) return null;
  for (let i = points.length - 2; i >= 0; i--) {
    const span = daysBetween(points[i].day, last.day);
    if (span >= WEEKLY_CHANGE_MIN_DAYS) {
      return ((last.trendKg - points[i].trendKg) * 7) / span;
    }
  }
  return null;
}

/** A weekly change this small (kg) reads as "steady". */
export const STEADY_KG_PER_WEEK = 0.05;

/** Which way the trend is going, in words the screen can use (no judgement either way). */
export function trendDirection(kgPerWeek: number): 'down' | 'up' | 'steady' {
  if (kgPerWeek <= -STEADY_KG_PER_WEEK) return 'down';
  if (kgPerWeek >= STEADY_KG_PER_WEEK) return 'up';
  return 'steady';
}
