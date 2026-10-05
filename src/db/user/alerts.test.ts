import { dismissAlerts, listAlertsForDay, markAlertsFired } from './alerts';

// A fresh in-memory user.db, built from the real migrations.
jest.mock('./client', () => {
  const db = jest.requireActual('./testing').openUserDbForTests();
  return { getUserDb: () => db };
});

describe('limit alerts', () => {
  it('fires an alert once a day, not twice', async () => {
    // Lunch takes fat past the limit: it fires.
    expect(await markAlertsFired('2026-09-28', ['fat'], 1000)).toEqual(['fat']);
    // A snack adds more fat, or lunch is deleted and logged again: it has already fired today.
    expect(await markAlertsFired('2026-09-28', ['fat'], 2000)).toEqual([]);
    // A different nutrient still fires on its own.
    expect(await markAlertsFired('2026-09-28', ['fat', 'sodium'], 3000)).toEqual(['sodium']);
    // A new day starts fresh.
    expect(await markAlertsFired('2026-09-29', ['fat'], 4000)).toEqual(['fat']);
  });

  it('closes alerts for the rest of the day', async () => {
    await dismissAlerts('2026-09-28', ['fat'], 5000);
    const rows = await listAlertsForDay('2026-09-28');
    const closed = rows.filter((r) => r.dismissedAt !== null).map((r) => r.alert);
    expect(closed).toEqual(['fat']);
  });
});
