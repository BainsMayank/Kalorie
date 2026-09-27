import {
  deleteEntry,
  insertEntries,
  insertEntry,
  listEntriesForDay,
  listFoodEntriesSince,
  listRecentFoods,
  purgeEntries,
  restoreEntries,
  updateEntry,
  type NewEntry,
} from './entries';
import { addFavourite, listFavourites, removeFavourite } from './favourites';
import { logEntries, mealSlots } from './schema';
import { DEFAULT_SLOTS, listMealSlots, seedMealSlots } from './slots';

// A fresh in-memory user.db per test file, built from the real migrations.
jest.mock('./client', () => {
  const db = jest.requireActual('./testing').openUserDbForTests();
  return { getUserDb: () => db };
});
const { getUserDb } = jest.requireMock('./client') as typeof import('./client');

const dal: NewEntry = {
  day: '2026-09-27',
  loggedAt: new Date(2026, 8, 27, 13, 30).getTime(),
  slotId: 'lunch',
  foodSource: 'base',
  foodId: '123',
  name: 'Mixed dal',
  qty: 1,
  unit: 'katori',
  grams: 150,
};

describe('meal slots', () => {
  it('adds the 4 default slots once, in order', async () => {
    await seedMealSlots();
    await seedMealSlots(); // a second app start adds nothing
    const slots = await listMealSlots();
    expect(slots.map((s) => s.id)).toEqual(['breakfast', 'lunch', 'snacks', 'dinner']);
    expect(slots[3]).toMatchObject({ startMin: 19 * 60, endMin: 4 * 60, isBuiltin: true });
    expect(slots[0].name).toBeNull(); // the name comes from en.json
    expect(slots).toHaveLength(DEFAULT_SLOTS.length);
  });

  it('keeps a slot the user changed when seeding again', async () => {
    await getUserDb().update(mealSlots).set({ name: 'Nashta', isHidden: true });
    await seedMealSlots();
    const [breakfast] = await listMealSlots();
    expect(breakfast).toMatchObject({ name: 'Nashta', isHidden: true });
  });
});

describe('log entries', () => {
  it('saves an entry with an id and timestamps', async () => {
    const saved = await insertEntry(dal, 1000);
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);

    const [row] = await listEntriesForDay('2026-09-27');
    expect(row).toMatchObject({ ...dal, oilLevel: 0, createdAt: 1000, deletedAt: null });
  });

  it('lists only that day, earliest first', async () => {
    const early = dal.loggedAt - 60_000;
    await insertEntry({ ...dal, name: 'Roti', loggedAt: early });
    await insertEntry({ ...dal, day: '2026-09-26', name: 'Yesterday’s poha' });

    const names = (await listEntriesForDay('2026-09-27')).map((e) => e.name);
    expect(names).toEqual(['Roti', 'Mixed dal']);
  });

  it('updates the amount, slot and time', async () => {
    const [entry] = await listEntriesForDay('2026-09-26');
    await updateEntry(entry.id, { qty: 2, grams: 300, slotId: 'dinner' }, 5000);

    const [row] = await listEntriesForDay('2026-09-26');
    expect(row).toMatchObject({ qty: 2, grams: 300, slotId: 'dinner', updatedAt: 5000 });
  });

  it('soft-deletes: the entry leaves the list but stays in the database', async () => {
    const [entry] = await listEntriesForDay('2026-09-26');
    await deleteEntry(entry.id, 9000);

    expect(await listEntriesForDay('2026-09-26')).toEqual([]);
    const all = await getUserDb().query.logEntries.findMany();
    expect(all.find((e) => e.id === entry.id)?.deletedAt).toBe(9000);
  });
});

describe('several entries at once (copy) and Undo', () => {
  const day = '2026-10-05';
  it('saves them in order with one shared batch id', async () => {
    const rows = await insertEntries(
      [
        { ...dal, day, name: 'A' },
        { ...dal, day, name: 'B' },
      ],
      2000,
    );
    expect(rows[0].batchId).toBeTruthy();
    expect(rows[1].batchId).toBe(rows[0].batchId);
    expect(rows.map((r) => r.createdAt)).toEqual([2000, 2001]);
    expect((await listEntriesForDay(day)).map((e) => e.name)).toEqual(['A', 'B']);
  });

  it('restores deleted entries', async () => {
    const [a] = await listEntriesForDay(day);
    await deleteEntry(a.id);
    await restoreEntries([a.id]);
    expect(await listEntriesForDay(day)).toHaveLength(2);
  });

  it('removes entries for good', async () => {
    const ids = (await listEntriesForDay(day)).map((e) => e.id);
    await purgeEntries(ids);
    const all = await getUserDb().query.logEntries.findMany();
    expect(all.some((e) => ids.includes(e.id))).toBe(false);
  });
});

describe('history for suggestions and recents', () => {
  beforeAll(async () => {
    await getUserDb().delete(logEntries);
    await insertEntry({ ...dal, day: '2026-09-01', foodId: 'old', qty: 1 }, 100);
    await insertEntry({ ...dal, day: '2026-09-20', foodId: 'dal', qty: 1 }, 200);
    await insertEntry({ ...dal, day: '2026-09-25', foodId: 'roti', qty: 2 }, 300);
    await insertEntry({ ...dal, day: '2026-09-26', foodId: 'dal', qty: 1.5 }, 400);
    await insertEntry(
      { ...dal, foodSource: 'quick', foodId: null, qty: null, unit: null, grams: null },
      500,
    );
    const gone = await insertEntry({ ...dal, day: '2026-09-27', foodId: 'gone' }, 600);
    await deleteEntry(gone.id);
  });

  it('lists food entries from a day on, without quick adds or deleted ones', async () => {
    const entries = await listFoodEntriesSince('2026-09-15');
    expect(entries.map((e) => e.foodId).sort()).toEqual(['dal', 'dal', 'roti']);
  });

  it('lists recent foods newest first, each with its latest amount', async () => {
    const recents = await listRecentFoods();
    expect(recents.map((e) => [e.foodId, e.qty])).toEqual([
      ['dal', 1.5],
      ['roti', 2],
      ['old', 1],
    ]);
    expect(await listRecentFoods(1)).toHaveLength(1);
  });
});

describe('favourites', () => {
  it('stars, lists newest first and un-stars foods', async () => {
    await addFavourite({ foodSource: 'base', foodId: '1' }, 1);
    await addFavourite({ foodSource: 'base', foodId: '2' }, 2);
    await addFavourite({ foodSource: 'base', foodId: '1' }, 3); // already starred
    expect((await listFavourites()).map((f) => f.foodId)).toEqual(['2', '1']);

    await removeFavourite({ foodSource: 'base', foodId: '2' });
    expect((await listFavourites()).map((f) => f.foodId)).toEqual(['1']);
  });
});
