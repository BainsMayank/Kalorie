import { deleteEntry, insertEntry } from './entries';
import { firstRecordedDay } from './export';
import { saveWeight } from './goals';
import { addWater, listWaterBetween } from './water';

// A fresh in-memory user.db per test file, built from the real migrations.
jest.mock('./client', () => {
  const db = jest.requireActual('./testing').openUserDbForTests();
  return { getUserDb: () => db };
});

describe('firstRecordedDay', () => {
  it('is null before anything is recorded, then the earliest day of any kind', async () => {
    expect(await firstRecordedDay()).toBeNull();

    await addWater('2026-09-10', 250);
    expect(await firstRecordedDay()).toBe('2026-09-10');

    await saveWeight('2026-09-05', 72);
    expect(await firstRecordedDay()).toBe('2026-09-05');

    const entry = await insertEntry({
      day: '2026-09-01',
      loggedAt: 0,
      slotId: 'lunch',
      foodSource: 'quick',
      foodId: null,
      name: '',
      qty: null,
      unit: null,
      grams: null,
      quickKcal: 300,
    });
    expect(await firstRecordedDay()).toBe('2026-09-01');

    // A deleted entry no longer counts.
    await deleteEntry(entry.id);
    expect(await firstRecordedDay()).toBe('2026-09-05');
  });
});

describe('listWaterBetween', () => {
  it('includes when each glass was drunk, earliest first', async () => {
    await addWater('2026-09-20', 250, 2000);
    await addWater('2026-09-20', 300, 1000);
    expect(await listWaterBetween('2026-09-20', '2026-09-20')).toEqual([
      { day: '2026-09-20', ml: 300, loggedAt: 1000 },
      { day: '2026-09-20', ml: 250, loggedAt: 2000 },
    ]);
  });
});
