// Weekly check-ins (SPEC §8.4): how last week felt, and whether its card was closed.

import { eq } from 'drizzle-orm';

import { getUserDb } from './client';
import { weeklyCheckins, type WeeklyCheckinRow } from './schema';

export type Feeling = NonNullable<WeeklyCheckinRow['feeling']>;

/** The check-in for the week starting `weekStart` (a Monday), or `null` if there is none yet. */
export async function getCheckin(weekStart: string): Promise<WeeklyCheckinRow | null> {
  const [row] = await getUserDb()
    .select()
    .from(weeklyCheckins)
    .where(eq(weeklyCheckins.weekStart, weekStart));
  return row ?? null;
}

/** Saves a change to a week's check-in, creating its row the first time. */
async function saveCheckin(
  weekStart: string,
  changes: Partial<Pick<WeeklyCheckinRow, 'feeling' | 'dismissedAt'>>,
  now: number,
): Promise<void> {
  await getUserDb()
    .insert(weeklyCheckins)
    .values({ weekStart, feeling: null, dismissedAt: null, createdAt: now, ...changes })
    .onConflictDoUpdate({ target: weeklyCheckins.weekStart, set: changes });
}

/** Saves the answer to "How did last week feel?". */
export async function saveFeeling(weekStart: string, feeling: Feeling, now = Date.now()) {
  await saveCheckin(weekStart, { feeling }, now);
}

/** Closes the week's card on Today. */
export async function dismissCheckin(weekStart: string, now = Date.now()) {
  await saveCheckin(weekStart, { dismissedAt: now }, now);
}
