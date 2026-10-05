import { dismissAlerts, listAlertsForDay, markAlertsFired } from './alerts';
import {
  EMPTY_ANSWERS,
  getProfile,
  latestWeight,
  listTargets,
  saveProfile,
  saveTargets,
  saveWeight,
  targetsFromRow,
} from './goals';
import { suggestTargets } from '@/lib/targets';

// A fresh in-memory user.db per test file, built from the real migrations.
jest.mock('./client', () => {
  const db = jest.requireActual('./testing').openUserDbForTests();
  return { getUserDb: () => db };
});

const values = suggestTargets({
  sex: 'f',
  age: 30,
  heightCm: 160,
  weightKg: 60,
  activity: 'sedentary',
  goal: 'maintain',
  paceKgWeek: null,
}).targets;

describe('profile', () => {
  it('saves answers and keeps the first onboarding time', async () => {
    expect(await getProfile()).toBeNull();
    await saveProfile({ ...EMPTY_ANSWERS, sex: 'f', goal: 'track' }, 1000);
    await saveProfile({ ...EMPTY_ANSWERS, sex: 'f', goal: 'maintain', heightCm: 160 }, 2000);
    expect(await getProfile()).toMatchObject({
      sex: 'f',
      goal: 'maintain',
      heightCm: 160,
      onboardedAt: 1000,
    });
  });
});

describe('targets', () => {
  it('adds a row per day and replaces a row saved twice on one day', async () => {
    await saveTargets('2026-09-27', values, false);
    await saveTargets('2026-10-01', { ...values, kcal: 1500 }, true);
    await saveTargets('2026-10-01', { ...values, kcal: 1600 }, true);
    const rows = await listTargets();
    expect(rows.map((r) => [r.effectiveFrom, r.kcal, r.isCustom])).toEqual([
      ['2026-09-27', values.kcal, false],
      ['2026-10-01', 1600, true],
    ]);
    expect(targetsFromRow(rows[0])).toEqual(values);
  });
});

describe('weights', () => {
  it('keeps one weigh-in per day and returns the latest', async () => {
    expect(await latestWeight()).toBeNull();
    await saveWeight('2026-09-27', 61);
    await saveWeight('2026-09-28', 60.5);
    await saveWeight('2026-09-28', 60.2);
    expect(await latestWeight()).toBe(60.2);
  });
});

describe('limit alerts', () => {
  it('fires each alert once per day, and closing one keeps it closed', async () => {
    expect(await markAlertsFired('2026-09-27', ['fat'])).toEqual(['fat']);
    expect(await markAlertsFired('2026-09-27', ['fat', 'sodium'])).toEqual(['sodium']);
    expect(await markAlertsFired('2026-09-27', ['fat', 'sodium'])).toEqual([]);
    expect(await markAlertsFired('2026-09-28', ['fat'])).toEqual(['fat']); // a new day

    await dismissAlerts('2026-09-27', ['fat']);
    const rows = await listAlertsForDay('2026-09-27');
    expect(rows.find((r) => r.alert === 'fat')?.dismissedAt).not.toBeNull();
    expect(rows.find((r) => r.alert === 'sodium')?.dismissedAt).toBeNull();
  });
});
