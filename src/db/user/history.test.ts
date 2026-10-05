import { sql } from 'drizzle-orm';

import { getUserDb } from './client';
import { deleteEntry, insertEntry, listEntriesBetween, type NewEntry } from './entries';
import { deleteWeight, latestWeight, listWeights, saveWeight } from './goals';
import { purgeDeletedRows } from './purge';
import { addWater, listWaterBetween, removeLastWater, waterForDay } from './water';

// A fresh in-memory user.db per test file, built from the real migrations.
jest.mock('./client', () => {
  const db = jest.requireActual('./testing').openUserDbForTests();
  return { getUserDb: () => db };
});

const quick = (day: string, kcal: number): NewEntry => ({
  day,
  loggedAt: 0,
  slotId: 'lunch',
  foodSource: 'quick',
  foodId: null,
  name: '',
  qty: null,
  unit: null,
  grams: null,
  quickKcal: kcal,
});

/** How SQLite plans to run a query, one line per step. */
async function queryPlan(query: string): Promise<string> {
  const rows = await getUserDb().all<unknown[]>(sql.raw(`EXPLAIN QUERY PLAN ${query}`));
  return rows.map((row) => String(row[row.length - 1])).join('\n');
}

describe('entries between two days', () => {
  it('returns the range, both ends included, without deleted entries', async () => {
    await insertEntry(quick('2026-08-31', 100));
    await insertEntry(quick('2026-09-01', 200));
    await insertEntry(quick('2026-09-15', 300));
    await insertEntry(quick('2026-09-30', 400));
    await insertEntry(quick('2026-10-01', 500));
    const gone = await insertEntry(quick('2026-09-10', 999));
    await deleteEntry(gone.id);

    const september = await listEntriesBetween('2026-09-01', '2026-09-30');
    expect(september.map((e) => e.quickKcal)).toEqual([200, 300, 400]);
    expect(await listEntriesBetween('2026-11-01', '2026-11-30')).toEqual([]);
  });

  it('is an index range search, not a full table scan', async () => {
    const plan = await queryPlan(
      "SELECT * FROM log_entries WHERE day >= '2026-09-01' AND day <= '2026-09-30' AND deleted_at IS NULL",
    );
    expect(plan).toMatch(
      /SEARCH log_entries USING INDEX log_entries_day_idx \(day>\? AND day<\?\)/,
    );
    expect(plan).not.toMatch(/SCAN log_entries/);
  });

  it('uses indexes for a single day, water and weights too', async () => {
    expect(
      await queryPlan("SELECT * FROM log_entries WHERE day = '2026-09-01' AND deleted_at IS NULL"),
    ).toMatch(/USING INDEX log_entries_day_idx \(day=\? AND deleted_at=\?\)/);
    expect(
      await queryPlan(
        "SELECT * FROM water_logs WHERE day >= '2026-09-01' AND day <= '2026-09-30' AND deleted_at IS NULL",
      ),
    ).toMatch(/USING INDEX water_logs_day_idx/);
    expect(
      await queryPlan("SELECT * FROM weights WHERE day = '2026-09-01' AND deleted_at IS NULL"),
    ).toMatch(/USING INDEX weights_day_idx/);
  });
});

describe('water', () => {
  it('adds glasses, takes the last one off, and adds up a day', async () => {
    await addWater('2026-09-20', 250, 1000);
    await addWater('2026-09-20', 250, 2000);
    await addWater('2026-09-20', 400, 3000);
    await addWater('2026-09-21', 250, 4000);
    expect(await waterForDay('2026-09-20')).toBe(900);

    expect(await removeLastWater('2026-09-20')).toBe(true);
    expect(await waterForDay('2026-09-20')).toBe(500); // the 400 ml went, the latest one
    expect(await removeLastWater('2026-09-22')).toBe(false);
    expect(await waterForDay('2026-09-22')).toBe(0);

    expect(await listWaterBetween('2026-09-20', '2026-09-21')).toEqual([
      { day: '2026-09-20', ml: 250, loggedAt: 1000 },
      { day: '2026-09-20', ml: 250, loggedAt: 2000 },
      { day: '2026-09-21', ml: 250, loggedAt: 4000 },
    ]);
  });

  it('removes taken-off water for good after 30 days', async () => {
    await addWater('2026-06-01', 250, 0);
    await removeLastWater('2026-06-01', 0);
    const countAll = async () =>
      (await getUserDb().all<unknown[]>(sql`SELECT count(*) FROM water_logs`))[0][0];
    const before = Number(await countAll());
    await purgeDeletedRows(31 * 24 * 60 * 60 * 1000);
    expect(Number(await countAll())).toBeLessThan(before);
  });
});

describe('weigh-ins', () => {
  it('lists them oldest first, one per day, and deletes one', async () => {
    await saveWeight('2026-09-03', 71, 3);
    await saveWeight('2026-09-01', 72, 1);
    await saveWeight('2026-09-03', 70.5, 4); // same day: replaces
    expect((await listWeights()).map((w) => [w.day, w.weightKg])).toEqual([
      ['2026-09-01', 72],
      ['2026-09-03', 70.5],
    ]);

    await deleteWeight('2026-09-03');
    expect((await listWeights()).map((w) => w.day)).toEqual(['2026-09-01']);
    expect(await latestWeight()).toBe(72);

    // A new weigh-in on a deleted day starts a fresh row.
    await saveWeight('2026-09-03', 70, 5);
    expect(await latestWeight()).toBe(70);
  });
});
