import { dismissCheckin, getCheckin, saveFeeling } from './checkins';
import { deleteEntry, insertEntry, listLoggedDays, type NewEntry } from './entries';

jest.mock('./client', () => {
  const db = jest.requireActual('./testing').openUserDbForTests();
  return { getUserDb: () => db };
});

const quick = (day: string): NewEntry => ({
  day,
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

describe('listLoggedDays', () => {
  it('lists each day with an entry once, up to the given day, leaving out deleted entries', async () => {
    await insertEntry(quick('2026-09-20'));
    await insertEntry(quick('2026-09-20'));
    await insertEntry(quick('2026-09-22'));
    const deleted = await insertEntry(quick('2026-09-23'));
    await deleteEntry(deleted.id);
    await insertEntry(quick('2026-09-30')); // after "today"

    expect((await listLoggedDays('2026-09-27')).sort()).toEqual(['2026-09-20', '2026-09-22']);
  });
});

describe('weekly check-ins', () => {
  it('has no row until the person answers or closes the card', async () => {
    expect(await getCheckin('2026-09-21')).toBeNull();
  });

  it('saves the feeling, then the close, in one row per week', async () => {
    await saveFeeling('2026-09-21', 'hard', 1000);
    await saveFeeling('2026-09-21', 'okay', 2000); // changing the answer
    await dismissCheckin('2026-09-21', 3000);
    expect(await getCheckin('2026-09-21')).toEqual({
      weekStart: '2026-09-21',
      feeling: 'okay',
      dismissedAt: 3000,
      createdAt: 1000,
    });
    expect(await getCheckin('2026-09-14')).toBeNull();
  });
});
