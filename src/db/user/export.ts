import { isNull, min } from 'drizzle-orm';

import { getUserDb } from './client';
import { logEntries, waterLogs, weights } from './schema';

/**
 * The first day anything was recorded (an entry, water or a weigh-in that isn't deleted), for the
 * export's *Everything* range. `null` when nothing has been recorded yet.
 */
export async function firstRecordedDay(): Promise<string | null> {
  const db = getUserDb();
  const [[entry], [water], [weight]] = await Promise.all([
    db
      .select({ day: min(logEntries.day) })
      .from(logEntries)
      .where(isNull(logEntries.deletedAt)),
    db
      .select({ day: min(waterLogs.day) })
      .from(waterLogs)
      .where(isNull(waterLogs.deletedAt)),
    db
      .select({ day: min(weights.day) })
      .from(weights)
      .where(isNull(weights.deletedAt)),
  ]);
  const days = [entry?.day, water?.day, weight?.day].filter((d): d is string => !!d).sort();
  return days[0] ?? null;
}
