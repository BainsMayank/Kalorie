import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { insertEntry, type NewEntry } from '@/db/user/entries';
import { saveTargets, saveWeight } from '@/db/user/goals';
import { addWater } from '@/db/user/water';
import type { TargetValues } from '@/lib/targets';
import { useGoalsStore } from '@/stores/goals';
import { useLogStore } from '@/stores/log';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settings';

import { TrendsScreen } from './TrendsScreen';

// Only quick adds, so foods.db isn't needed.
jest.mock('@/db/foods/client', () => ({
  getFoodsDb: async () => {
    throw new Error('foods.db is not needed for quick adds');
  },
}));
jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});
jest.mock('@/db/user/settings', () => ({
  readAllSettings: jest.fn(async () => ({})),
  writeSetting: jest.fn(async () => {}),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const TODAY = '2026-09-27';
const TARGETS: TargetValues = {
  kcal: 2000,
  protein_g: 60,
  carb_g: 250,
  fat_g: 65,
  fibre_g: 25,
  sodium_mg_limit: 2000,
  sugar_g_limit: 50,
  sat_fat_g_limit: 22,
  fat_g_limit: 65,
};

const quick = (day: string, kcal: number, protein = 20): NewEntry => ({
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
  quickProteinG: protein,
  quickCarbG: 100,
  quickFatG: 20,
});

/** Logs a day as `meals` quick adds adding up to `kcal`. */
async function logDay(day: string, kcal: number, meals = 3) {
  for (let i = 0; i < meals; i++) await insertEntry(quick(day, kcal / meals));
}

beforeAll(async () => {
  await useLogStore.getState().load();
  await saveTargets('2026-09-01', TARGETS, false);
  await logDay('2026-09-21', 2000); // on target
  await logDay('2026-09-22', 2400); // a bit over
  // 23rd: nothing
  await logDay('2026-09-24', 1000); // further from target
  await logDay('2026-09-25', 900, 1); // partly logged
  await logDay('2026-09-26', 1900); // on target
  await logDay(TODAY, 700); // today, still going
  await saveWeight('2026-09-10', 72);
  await saveWeight('2026-09-20', 71.6);
  await saveWeight('2026-09-26', 71.2);
  await addWater('2026-09-26', 250);
  await addWater('2026-09-26', 250);
  await addWater(TODAY, 1000);
});

beforeEach(async () => {
  jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 8, 27, 15).getTime());
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: true });
  await useGoalsStore.getState().load();
  mockPush.mockClear();
});
afterEach(() => jest.restoreAllMocks());

async function renderTrends() {
  await render(<TrendsScreen />);
  await act(async () => {}); // let the days load
}

describe('Trends: calendar', () => {
  it('colours each day by how close it came to its target, with a legend', async () => {
    await renderTrends();

    expect(screen.getByLabelText('Mon, 21 Sep, On target')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tue, 22 Sep, Close to target')).toBeOnTheScreen();
    expect(screen.getByLabelText('Wed, 23 Sep, Not logged')).toBeOnTheScreen();
    expect(screen.getByLabelText('Thu, 24 Sep, Further from target')).toBeOnTheScreen();
    expect(screen.getByLabelText('Fri, 25 Sep, Partly logged')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sun, 27 Sep, Partly logged')).toBeOnTheScreen(); // still going

    expect(screen.getByText('6 days logged · 2 on target')).toBeOnTheScreen();
    for (const word of ['On target', 'Close to target', 'Further from target']) {
      expect(screen.getByText(word)).toBeOnTheScreen();
    }
    expect(screen.getByText('Partly logged')).toBeOnTheScreen();
    expect(screen.getByText('Not logged')).toBeOnTheScreen();
  });

  it('opens a day when it is tapped, but not a day still to come', async () => {
    await renderTrends();
    await fireEvent.press(screen.getByTestId('history-day-2026-09-22'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/day/[day]',
      params: { day: '2026-09-22' },
    });

    mockPush.mockClear();
    await fireEvent.press(screen.getByTestId('history-day-2026-09-28'));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('Trends: week', () => {
  it('averages calories and macros over logged days, today left out while it’s going', async () => {
    await renderTrends();
    await fireEvent.press(screen.getByRole('radio', { name: 'Week' }));
    await act(async () => {});

    // 21st–26th: 2000 + 2400 + 1000 + 900 + 1900 = 8200 over 5 days.
    expect(
      screen.getByText('On average 1,640 of 2,000 kcal a day · 2 of 5 days on target'),
    ).toBeOnTheScreen();
    // Protein: 3 × 20 g on four days, 20 g on the partly logged one = 260 g over 5 days.
    expect(screen.getByText('52 of 60 g')).toBeOnTheScreen();
  });

  it('shows the weight trend and the weekly change as a calm number', async () => {
    await renderTrends();
    await fireEvent.press(screen.getByRole('radio', { name: 'Week' }));
    await act(async () => {});

    // Trend: 72 → 71.96 → 71.884. The 20th is only 6 days back, so it uses the 10th:
    // (71.884 − 72) × 7 / 16 ≈ −0.051 kg a week, shown as −0.1.
    expect(screen.getByText('Trend 71.9 kg · −0.1 kg a week')).toBeOnTheScreen();
    expect(screen.getByLabelText('Yesterday, 71.2 kg')).toBeOnTheScreen();
  });

  it('adds a weigh-in from the Add weight sheet', async () => {
    await renderTrends();
    await fireEvent.press(screen.getByRole('radio', { name: 'Week' }));
    await act(async () => {});

    await fireEvent.press(screen.getByRole('button', { name: 'Add weight' }));
    expect(screen.getByTestId('weight-kg')).toHaveDisplayValue('71.2'); // starts at the latest
    await fireEvent.changeText(screen.getByTestId('weight-kg'), '70.8');
    await fireEvent.press(screen.getByTestId('weight-save'));
    await act(async () => {});

    expect(screen.getByLabelText('Today, 70.8 kg')).toBeOnTheScreen();
    expect(useGoalsStore.getState().weightKg).toBe(70.8);

    // …and deletes it again.
    await fireEvent.press(screen.getByLabelText('Today, 70.8 kg'));
    await fireEvent.press(screen.getByTestId('weight-delete'));
    await act(async () => {});
    expect(screen.queryByLabelText('Today, 70.8 kg')).toBeNull();
    expect(useGoalsStore.getState().weightKg).toBe(71.2);
  });

  it('won’t save a weight that can’t be right', async () => {
    await renderTrends();
    await fireEvent.press(screen.getByRole('radio', { name: 'Week' }));
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Add weight' }));
    await fireEvent.changeText(screen.getByTestId('weight-kg'), '7');
    expect(screen.getByTestId('weight-save')).toBeDisabled();
  });

  it('averages water over the days with water logged', async () => {
    await renderTrends();
    await fireEvent.press(screen.getByRole('radio', { name: 'Week' }));
    await act(async () => {});
    expect(screen.getByText('On average 750 ml a day · goal 2,000 ml')).toBeOnTheScreen();
  });
});

describe('Trends: month', () => {
  it('uses the last 30 days', async () => {
    await renderTrends();
    await fireEvent.press(screen.getByRole('radio', { name: 'Month' }));
    await act(async () => {});
    expect(
      screen.getByText('On average 1,640 of 2,000 kcal a day · 2 of 5 days on target'),
    ).toBeOnTheScreen();
  });
});
