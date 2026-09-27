// Log entries: what was eaten, when and how much (SPEC §4.2). Deleting only sets `deleted_at`
// (soft delete), so an entry can be brought back.

import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, max, ne } from 'drizzle-orm';

import { uuid } from '@/lib/uuid';

import { getUserDb } from './client';
import { logEntries, type LogEntry } from './schema';

/** What the app fills in for a new entry; ids and timestamps are added here. */
export type NewEntry = Pick<
  LogEntry,
  'day' | 'loggedAt' | 'slotId' | 'foodSource' | 'foodId' | 'name' | 'qty' | 'unit' | 'grams'
> &
  Partial<
    Pick<
      LogEntry,
      'oilLevel' | 'quickKcal' | 'quickProteinG' | 'quickCarbG' | 'quickFatG' | 'note' | 'batchId'
    >
  >;

/** The parts of an entry the Edit sheet can change. */
export type EntryChanges = Partial<
  Pick<
    LogEntry,
    | 'name'
    | 'loggedAt'
    | 'slotId'
    | 'qty'
    | 'unit'
    | 'grams'
    | 'oilLevel'
    | 'note'
    | 'quickKcal'
    | 'quickProteinG'
    | 'quickCarbG'
    | 'quickFatG'
  >
>;

/** A full row for a new entry: defaults, a new id and timestamps. */
function newRow(entry: NewEntry, now: number): LogEntry {
  return {
    oilLevel: 0,
    quickKcal: null,
    quickProteinG: null,
    quickCarbG: null,
    quickFatG: null,
    note: null,
    batchId: null,
    ...entry,
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

/** Saves a new entry and returns it. */
export async function insertEntry(entry: NewEntry, now = Date.now()): Promise<LogEntry> {
  const row = newRow(entry, now);
  await getUserDb().insert(logEntries).values(row);
  return row;
}

/**
 * Saves several entries made in one action (a copy), sharing one batch id so Undo can take them
 * back together. Their creation times go up by 1 ms each, which keeps them in order.
 */
export async function insertEntries(
  entries: readonly NewEntry[],
  now = Date.now(),
): Promise<LogEntry[]> {
  if (entries.length === 0) return [];
  const batchId = uuid();
  const rows = entries.map((entry, i) => newRow({ ...entry, batchId }, now + i));
  await getUserDb().insert(logEntries).values(rows);
  return rows;
}

/** Changes an entry (not a deleted one). */
export async function updateEntry(
  id: string,
  changes: EntryChanges,
  now = Date.now(),
): Promise<void> {
  await getUserDb()
    .update(logEntries)
    .set({ ...changes, updatedAt: now })
    .where(and(eq(logEntries.id, id), isNull(logEntries.deletedAt)));
}

/** Soft-deletes an entry: it disappears from the log but stays in the database for 30 days. */
export async function deleteEntry(id: string, now = Date.now()): Promise<void> {
  await getUserDb()
    .update(logEntries)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(logEntries.id, id), isNull(logEntries.deletedAt)));
}

/** Brings soft-deleted entries back (Undo after a delete). */
export async function restoreEntries(ids: readonly string[], now = Date.now()): Promise<void> {
  if (ids.length === 0) return;
  await getUserDb()
    .update(logEntries)
    .set({ deletedAt: null, updatedAt: now })
    .where(inArray(logEntries.id, [...ids]));
}

/**
 * Removes entries for good. Only for Undo right after they were made (a log or a copy), so an
 * undone copy doesn't linger in *Recently deleted*.
 */
export async function purgeEntries(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await getUserDb()
    .delete(logEntries)
    .where(inArray(logEntries.id, [...ids]));
}

/** Food entries (not quick adds) from `day` on, for time-of-day suggestions. */
export async function listFoodEntriesSince(day: string): Promise<LogEntry[]> {
  return getUserDb()
    .select()
    .from(logEntries)
    .where(
      and(
        gte(logEntries.day, day),
        isNull(logEntries.deletedAt),
        ne(logEntries.foodSource, 'quick'),
        isNotNull(logEntries.foodId),
      ),
    );
}

/**
 * Recents (SPEC §4.2): the latest entry of each of the `limit` foods logged most recently,
 * newest first. Each row's amount is the one used last time.
 */
export async function listRecentFoods(limit = 30): Promise<LogEntry[]> {
  const db = getUserDb();
  const latest = db
    .select({
      foodSource: logEntries.foodSource,
      foodId: logEntries.foodId,
      last: max(logEntries.createdAt).as('last'),
    })
    .from(logEntries)
    .where(
      and(
        isNull(logEntries.deletedAt),
        ne(logEntries.foodSource, 'quick'),
        isNotNull(logEntries.foodId),
      ),
    )
    .groupBy(logEntries.foodSource, logEntries.foodId)
    .orderBy(desc(max(logEntries.createdAt)))
    .limit(limit)
    .as('latest');

  const rows = await db
    .select({ entry: logEntries })
    .from(logEntries)
    .innerJoin(
      latest,
      and(
        eq(logEntries.foodSource, latest.foodSource),
        eq(logEntries.foodId, latest.foodId),
        eq(logEntries.createdAt, latest.last),
      ),
    )
    .where(isNull(logEntries.deletedAt))
    .orderBy(desc(logEntries.createdAt));

  // Two entries of one food made in the same millisecond (a copy) would both match: keep one.
  const seen = new Set<string>();
  return rows
    .map((row) => row.entry)
    .filter((entry) => {
      const key = `${entry.foodSource}:${entry.foodId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** A day's entries that aren't deleted, earliest first. */
export async function listEntriesForDay(day: string): Promise<LogEntry[]> {
  return getUserDb()
    .select()
    .from(logEntries)
    .where(and(eq(logEntries.day, day), isNull(logEntries.deletedAt)))
    .orderBy(asc(logEntries.loggedAt), asc(logEntries.createdAt));
}
