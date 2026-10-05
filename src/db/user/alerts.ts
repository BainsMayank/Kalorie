// Limit alerts that fired or were closed (SPEC §6): one row per nutrient per day at most.

import { and, eq, inArray } from 'drizzle-orm';

import type { AlertKey } from '@/lib/alerts';

import { getUserDb } from './client';
import { limitAlerts, type LimitAlertRow } from './schema';

/** The alerts that have fired on `day`. */
export async function listAlertsForDay(day: string): Promise<LimitAlertRow[]> {
  return getUserDb().select().from(limitAlerts).where(eq(limitAlerts.day, day));
}

/**
 * Records that alerts fired on `day` and returns the ones that hadn't fired yet. An alert that
 * already has a row is left alone, so asking twice never fires it twice.
 */
export async function markAlertsFired(
  day: string,
  alerts: readonly AlertKey[],
  now = Date.now(),
): Promise<AlertKey[]> {
  if (alerts.length === 0) return [];
  const db = getUserDb();
  const existing = await db
    .select({ alert: limitAlerts.alert })
    .from(limitAlerts)
    .where(and(eq(limitAlerts.day, day), inArray(limitAlerts.alert, [...alerts])));
  const already = new Set(existing.map((r) => r.alert));
  const fresh = alerts.filter((a) => !already.has(a));
  if (fresh.length > 0) {
    await db
      .insert(limitAlerts)
      .values(fresh.map((alert) => ({ day, alert, firedAt: now, dismissedAt: null })))
      .onConflictDoNothing();
  }
  return fresh;
}

/** Closes alerts on the Today card for the rest of `day`. */
export async function dismissAlerts(
  day: string,
  alerts: readonly AlertKey[],
  now = Date.now(),
): Promise<void> {
  if (alerts.length === 0) return;
  await getUserDb()
    .update(limitAlerts)
    .set({ dismissedAt: now })
    .where(and(eq(limitAlerts.day, day), inArray(limitAlerts.alert, [...alerts])));
}
