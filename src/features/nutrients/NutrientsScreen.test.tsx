import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { getCommonFoods, searchFoods } from '@/db/foods';
import { openFoodsDbForTests } from '@/db/foods/testing';
import { insertEntry, type NewEntry } from '@/db/user/entries';
import { saveProfile, saveTargets } from '@/db/user/goals';
import type { TargetValues } from '@/lib/targets';
import { useGoalsStore } from '@/stores/goals';
import { useLogStore } from '@/stores/log';
import { useSettingsStore } from '@/stores/settings';

import { NutrientsScreen } from './NutrientsScreen';

// Foods come from the real foods.db; user.db is a fresh in-memory database.
jest.mock('@/db/foods/client', () => {
  const { openFoodsDbForTests: open } = jest.requireActual('@/db/foods/testing');
  const db = open();
  return { getFoodsDb: async () => db };
});
jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});
jest.mock('@/db/user/settings', () => ({
  readAllSettings: jest.fn(async () => ({})),
  writeSetting: jest.fn(async () => {}),
}));
const mockPush = jest.fn();
let mockParams: { day?: string; period?: string } = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: mockPush }),
}));

const foodsDb = openFoodsDbForTests();
afterAll(() => foodsDb.close());

const TODAY = '2026-09-27';
const at = (day: number, h: number) => new Date(2026, 8, day, h).getTime();

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

function base(day: number, foodId: number, name: string, grams: number): NewEntry {
  return {
    foodSource: 'base',
    day: `2026-09-${day}`,
    loggedAt: at(day, 13),
    slotId: 'lunch',
    foodId: String(foodId),
    name,
    qty: grams,
    unit: 'g',
    grams,
  };
}

beforeAll(async () => {
  await useLogStore.getState().load();
  // A 30-year-old woman who mostly sits: iron 29 mg a day (ICMR-NIN p. 13).
  await saveProfile(
    {
      sex: 'f',
      birthYear: 1996,
      heightCm: 160,
      activity: 'sedentary',
      goal: 'maintain',
      paceKgWeek: 0,
    },
    Date.now(),
  );
  await saveTargets('2026-09-01', TARGETS, false);
  await useGoalsStore.getState().load();

  const [dal] = await searchFoods(foodsDb, 'daal');
  const guava = (await getCommonFoods(foodsDb)).find((f) => f.name === 'Guava, white flesh')!;
  // Today: dal, guava and a quick add (no vitamin data at all).
  await insertEntry(base(27, dal.id, 'Mixed dal', 150));
  await insertEntry(base(27, guava.foodId, 'Guava, white flesh', 100));
  await insertEntry({
    ...base(27, 0, 'Wedding buffet', 0),
    foodSource: 'quick',
    foodId: null,
    qty: null,
    unit: null,
    grams: null,
    quickKcal: 900,
  });
  // Yesterday: dal only. Nothing before that.
  await insertEntry(base(26, dal.id, 'Mixed dal', 300));
});

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(at(27, 15));
  useSettingsStore.setState({ diet: 'any' });
  mockParams = { day: TODAY, period: 'day' };
  mockPush.mockClear();
});
afterEach(() => jest.restoreAllMocks());

async function renderScreen() {
  await render(<NutrientsScreen />);
  await act(async () => {}); // entries
  await act(async () => {}); // foods.db
}

describe('NutrientsScreen', () => {
  it('lists every vitamin and mineral, grouped, for the day', async () => {
    await renderScreen();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Vitamins')).toBeTruthy();
    expect(screen.getByText('Minerals')).toBeTruthy();
    expect(screen.getByText('Fibre, fats and sugar')).toBeTruthy();
    for (const name of ['Vitamin B12', 'Vitamin C', 'Iron', 'Calcium', 'Iodine', 'Cholesterol']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it('marks nutrients some foods have no data for, instead of showing a plain low number', async () => {
    await renderScreen();
    // The quick add has no vitamin data: 2 of the 3 foods count.
    const iron = screen.getByRole('button', { name: /^Iron\./ });
    expect(iron.props.accessibilityLabel).toMatch(/≈ \d+(\.\d)? mg/);
    expect(iron.props.accessibilityLabel).toContain('At least this · based on 2 of 3 foods');
    expect(iron.props.accessibilityLabel).toMatch(/\d+% of 29 mg/);
    // INDB and IFCT have no B12 at all: no number, no bar.
    const b12 = screen.getByRole('button', { name: /^Vitamin B12\./ });
    expect(b12.props.accessibilityLabel).toContain('No data for the foods eaten');
    expect(screen.queryByTestId('bar-vit_b12_ug')).toBeNull();
    expect(screen.getByText(/≈ means some foods you ate have no data/)).toBeTruthy();
  });

  it('shows where a nutrient came from and everyday foods rich in it, vegetarian first', async () => {
    useSettingsStore.setState({ diet: 'veg' });
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Vitamin C\./ }));

    expect(screen.getByText('Some foods have no data for this')).toBeTruthy();
    expect(screen.getByText('No data: Wedding buffet')).toBeTruthy();
    expect(screen.getByText('Where it came from')).toBeTruthy();
    const from = screen.getByLabelText(/^Guava, white flesh: \d+ mg, \d+% of the total$/);
    expect(from).toBeTruthy();

    expect(screen.getByText('Good sources')).toBeTruthy();
    const rich = screen.getAllByRole('button', { name: /· \d+ mg · \d+%$/ });
    expect(rich).toHaveLength(5);
    expect(rich[0].props.accessibilityLabel).toMatch(
      /^Guava, white flesh: 1 guava · 214 mg · 329%$/,
    );
    expect(screen.getByText('One everyday portion each. Vegetarian foods first.')).toBeTruthy();

    await fireEvent.press(rich[0]);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/food/[id]',
      params: { id: expect.any(String) },
    });
  });

  it('averages a week over the logged days, leaving out a day that is still going', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('radio', { name: '7-day average' }));
    await act(async () => {});
    // Today is partly logged (under target), so only yesterday counts.
    expect(screen.getByText(/^A day, across 1 logged day · /)).toBeTruthy();
    const iron = screen.getByRole('button', { name: /^Iron\./ });
    expect(iron.props.accessibilityLabel).not.toContain('≈'); // yesterday's dal has iron data
  });

  it('says so when nothing is logged', async () => {
    mockParams = { day: '2026-09-20', period: 'day' };
    await renderScreen();
    expect(screen.getByText(/Nothing logged on this day yet/)).toBeTruthy();
    expect(screen.queryByText('Vitamins')).toBeNull();
  });

  it('never colours a bar red, even far above the need', async () => {
    await renderScreen();
    const vitC = screen.getByTestId('bar-vit_c_mg');
    const color = String(vitC.props.style.backgroundColor).toLowerCase();
    expect(color).not.toMatch(/red|#f00|#ff0000|#e53935|#d32f2f/);
    expect(
      within(screen.getByRole('button', { name: /^Vitamin C\./ })).getByText(/≈/),
    ).toBeTruthy();
  });
});
