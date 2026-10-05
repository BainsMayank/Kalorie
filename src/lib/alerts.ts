// Limit alerts (SPEC §6): fat, saturated fat, sugar and sodium. An alert fires when the day's
// total reaches 100% of its limit, at most once per nutrient per day.

import type { NutrientKey, NutrientValues } from './nutrients';
import type { TargetValues } from './targets/formulas';

export type AlertKey = 'fat' | 'sat_fat' | 'sugar' | 'sodium';

/** In the order they are listed on the Today card. */
export const ALERTS = [
  { key: 'fat', nutrient: 'fat_g', limit: 'fat_g_limit', unit: 'g' },
  { key: 'sat_fat', nutrient: 'sat_fat_g', limit: 'sat_fat_g_limit', unit: 'g' },
  { key: 'sugar', nutrient: 'sugar_g', limit: 'sugar_g_limit', unit: 'g' },
  { key: 'sodium', nutrient: 'sodium_mg', limit: 'sodium_mg_limit', unit: 'mg' },
] as const satisfies readonly {
  key: AlertKey;
  nutrient: NutrientKey;
  limit: keyof TargetValues;
  unit: 'g' | 'mg';
}[];

export const ALERT_KEYS: readonly AlertKey[] = ALERTS.map((a) => a.key);

/** Every alert is on unless switched off in Goals (SPEC §4.2 `alerts_enabled`). */
export type AlertToggles = Record<AlertKey, boolean>;
export const ALL_ALERTS_ON: AlertToggles = { fat: true, sat_fat: true, sugar: true, sodium: true };

export type Limits = Pick<
  TargetValues,
  'fat_g_limit' | 'sat_fat_g_limit' | 'sugar_g_limit' | 'sodium_mg_limit'
>;

export interface CrossedLimit {
  key: AlertKey;
  nutrient: NutrientKey;
  unit: 'g' | 'mg';
  total: number;
  limit: number;
  /** How far above the limit (0 when exactly at it). */
  above: number;
}

/**
 * The limits a day's totals have reached (total ≥ limit), for alerts that are switched on.
 * Unknown totals never count; a limit of 0 or less is ignored.
 */
export function crossedLimits(
  totals: NutrientValues,
  limits: Limits,
  toggles: AlertToggles = ALL_ALERTS_ON,
): CrossedLimit[] {
  const crossed: CrossedLimit[] = [];
  for (const alert of ALERTS) {
    const total = totals[alert.nutrient];
    const limit = limits[alert.limit];
    if (!toggles[alert.key] || total === null || limit <= 0 || total < limit) continue;
    crossed.push({
      key: alert.key,
      nutrient: alert.nutrient,
      unit: alert.unit,
      total,
      limit,
      above: total - limit,
    });
  }
  return crossed;
}

/**
 * What the Today card lists: crossed limits the person hasn't closed today. Amounts stay live, so
 * "12 g above" becomes "15 g above" after another snack.
 */
export function visibleAlerts(
  crossed: readonly CrossedLimit[],
  dismissedToday: ReadonlySet<AlertKey>,
): CrossedLimit[] {
  return crossed.filter((c) => !dismissedToday.has(c.key));
}

/** Reads the `alerts_enabled` setting; anything missing or unreadable counts as on. */
export function parseAlertToggles(value: unknown): AlertToggles {
  const toggles = { ...ALL_ALERTS_ON };
  if (value && typeof value === 'object') {
    for (const key of ALERT_KEYS) {
      const v = (value as Record<string, unknown>)[key];
      if (typeof v === 'boolean') toggles[key] = v;
    }
  }
  return toggles;
}
