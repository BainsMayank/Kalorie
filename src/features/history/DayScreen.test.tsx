import '@/i18n';

import { act, render, screen, fireEvent } from '@testing-library/react-native';

import { insertEntry, type NewEntry } from '@/db/user/entries';
import { saveTargets } from '@/db/user/goals';
import { addWater } from '@/db/user/water';
import type { TargetValues } from '@/lib/targets';
import { useGoalsStore } from '@/stores/goals';
import { useLogStore } from '@/stores/log';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settings';

import { DayScreen } from './DayScreen';

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
let mockDay = '2026-09-22';
const mockDismissTo = jest.fn();
const mockSetOptions = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ day: mockDay }),
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useRouter: () => ({ dismissTo: mockDismissTo, push: jest.fn() }),
}));

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

const quick = (slotId: string, name: string, kcal: number): NewEntry => ({
  day: '2026-09-22',
  loggedAt: new Date(2026, 8, 22, slotId === 'breakfast' ? 8 : 13).getTime(),
  slotId,
  foodSource: 'quick',
  foodId: null,
  name,
  qty: null,
  unit: null,
  grams: null,
  quickKcal: kcal,
  quickProteinG: 10,
  quickCarbG: 50,
  quickFatG: 10,
});

beforeAll(async () => {
  await useLogStore.getState().load();
  await saveTargets('2026-09-01', TARGETS, false);
  await useGoalsStore.getState().load();
  await insertEntry(quick('breakfast', 'Poha', 350));
  await insertEntry(quick('lunch', 'Rajma chawal', 650));
  await addWater('2026-09-22', 500);
});

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 8, 27, 15).getTime());
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: true });
  useLogStore.setState({ day: '2026-09-27' });
  mockDay = '2026-09-22';
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());

async function renderDay() {
  await render(<DayScreen />);
  await act(async () => {});
}

describe('A past day from the calendar', () => {
  it('shows the Today layout for that date', async () => {
    await renderDay();

    expect(mockSetOptions).toHaveBeenCalledWith({ title: 'Tue, 22 Sep' });
    expect(
      screen.getByRole('image', { name: '1,000 of 2,000 kcal eaten. 1,000 kcal left' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Top contributors')).toBeOnTheScreen();
    expect(screen.getByText('500 of 2,000 ml · 2 glasses')).toBeOnTheScreen();
    expect(screen.getByLabelText('Poha, 350 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Rajma chawal, 650 kcal')).toBeOnTheScreen();
  });

  it('is read-only: no add, copy, delete or water buttons, and empty meals are left out', async () => {
    await renderDay();

    expect(screen.queryByRole('button', { name: /^Add food to/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Copy/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Save .* as a thali/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /glass of water/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Poha, 350 kcal' })).toBeNull();
    expect(screen.queryByText('Dinner')).toBeNull();
    expect(screen.getByText('Lunch')).toBeOnTheScreen();
  });

  it('Edit opens the Log tab on that day', async () => {
    await renderDay();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Tue, 22 Sep in the Log tab' }));

    expect(useLogStore.getState().day).toBe('2026-09-22');
    expect(mockDismissTo).toHaveBeenCalledWith('/log');
  });

  it('says so calmly when nothing was logged', async () => {
    mockDay = '2026-09-23';
    await renderDay();
    expect(screen.getByText('Nothing was logged on this day.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add food' })).toBeNull();
  });
});
