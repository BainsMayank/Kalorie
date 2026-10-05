// Water logs (SPEC §4.2): one row per glass (or custom amount). Taking one off only sets
// `deleted_at`, like entries; the purge removes it for good after 30 days.

import { and, asc, desc, eq, gte, isNull, lte, sum } from 'drizzle-orm';

import { uuid } from '@/lib/uuid';

import { getUserDb } from './client';
import { waterLogs, type WaterLogRow } from './schema';

/** Adds `ml` of water to a day. */
export async function addWater(day: string, ml: number, now = Date.now()): Promise<WaterLogRow> {
  const row: WaterLogRow = {
    id: uuid(),
    day,
    loggedAt: now,
    ml: Math.round(ml),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await getUserDb().insert(waterLogs).values(row);
  return row;
}

/** Takes off the day's most recent water log (the − button). Returns false if there was none. */
export async function removeLastWater(day: string, now = Date.now()): Promise<boolean> {
  const db = getUserDb();
  const [last] = await db
    .select({ id: waterLogs.id })
    .from(waterLogs)
    .where(and(eq(waterLogs.day, day), isNull(waterLogs.deletedAt)))
    .orderBy(desc(waterLogs.loggedAt), desc(waterLogs.createdAt))
    .limit(1);
  if (!last) return false;
  await db
    .update(waterLogs)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(waterLogs.id, last.id));
  return true;
}

/** The ml drunk on a day. */
export async function waterForDay(day: string): Promise<number> {
  const [row] = await getUserDb()
    .select({ ml: sum(waterLogs.ml) })
    .from(waterLogs)
    .where(and(eq(waterLogs.day, day), isNull(waterLogs.deletedAt)));
  return Number(row?.ml ?? 0);
}

/** Water logs that aren't deleted from `from` to `to` (both included). */
export async function listWaterBetween(
  from: string,
  to: string,
): Promise<Pick<WaterLogRow, 'day' | 'ml' | 'loggedAt'>[]> {
  return getUserDb()
    .select({ day: waterLogs.day, ml: waterLogs.ml, loggedAt: waterLogs.loggedAt })
    .from(waterLogs)
    .where(and(gte(waterLogs.day, from), lte(waterLogs.day, to), isNull(waterLogs.deletedAt)))
    .orderBy(asc(waterLogs.day), asc(waterLogs.loggedAt));
}
