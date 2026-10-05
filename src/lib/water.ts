// Water (SPEC §2.2 water row, §4.2 `water_logs`): each tap on + adds one glass.

/** SPEC §1: a 250 ml glass and a 2000 ml goal, both editable in Goals. */
export const DEFAULT_GLASS_ML = 250;
export const DEFAULT_WATER_GOAL_ML = 2000;

/** Sensible bounds for what can be typed in. */
export const GLASS_ML_RANGE = { min: 50, max: 1000 } as const;
export const WATER_GOAL_RANGE = { min: 250, max: 10000 } as const;
/** One custom amount (long-press on +). */
export const CUSTOM_ML_RANGE = { min: 10, max: 2000 } as const;

/** A stored or typed ml value, or `fallback` if it is missing or out of range. Whole ml. */
export function parseMl(
  value: unknown,
  range: { min: number; max: number },
  fallback: number,
): number {
  const ml = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(ml) || ml < range.min || ml > range.max) return fallback;
  return Math.round(ml);
}

/** How many glasses `ml` is, to one decimal ("3", "2.5"). */
export function glasses(ml: number, glassMl: number): number {
  if (glassMl <= 0) return 0;
  return Math.round((ml / glassMl) * 10) / 10;
}

/** How many glass icons the water row shows: the goal in glasses, at least 1, at most 12. */
export function goalGlasses(goalMl: number, glassMl: number): number {
  if (glassMl <= 0) return 1;
  return Math.min(12, Math.max(1, Math.ceil(goalMl / glassMl)));
}
