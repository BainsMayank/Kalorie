import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getFoodDetail, searchFoods } from '@/db/foods';
import { openFoodsDbForTests } from '@/db/foods/testing';
import { saveRecipe } from '@/db/user/customFoods';
import { insertEntry, listEntriesForDay } from '@/db/user/entries';
import { listThalis } from '@/db/user/thalis';
import { AddFoodScreen } from '@/features/log/AddFoodScreen';
import { LogScreen } from '@/features/log/LogScreen';
import { emptyNutrients } from '@/lib/nutrients';
import { useLogStore } from '@/stores/log';
import { useUndoStore } from '@/stores/undo';

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
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ slot: 'lunch' }),
}));

const foodsDb = openFoodsDbForTests();
afterAll(() => foodsDb.close());

const YESTERDAY = '2026-09-26';
const TODAY = '2026-09-27';
const at = (h: number, min = 0) => new Date(2026, 8, 27, h, min).getTime();

let dalKcal = 0; // per 100 g, with its oil step
let dalOilKcal = 0;

beforeAll(async () => {
  await useLogStore.getState().load();
  const [dal] = await searchFoods(foodsDb, 'daal');
  const [roti] = await searchFoods(foodsDb, 'roti');
  const dalFood = (await getFoodDetail(foodsDb, dal.id))!;
  dalKcal = dalFood.nutrients.energy_kcal!;
  dalOilKcal = dalFood.oilStep!.energy_kcal;

  // Yesterday's lunch: dal with more oil, 2 roti, and a quick add.
  const base = { foodSource: 'base' as const, day: YESTERDAY, slotId: 'lunch' };
  const noon = at(13) - 86_400_000;
  await insertEntry({
    ...base,
    loggedAt: noon,
    foodId: String(dal.id),
    name: 'Mixed dal',
    qty: 1,
    unit: 'katori',
    grams: 150,
    oilLevel: 1,
  });
  await insertEntry({
    ...base,
    loggedAt: noon + 60_000,
    foodId: String(roti.id),
    name: 'Chapati/Roti',
    qty: 2,
    unit: 'roti_m',
    grams: 70,
  });
  await insertEntry({
    ...base,
    loggedAt: noon + 120_000,
    foodSource: 'quick',
    foodId: null,
    name: 'Pickle',
    qty: null,
    unit: null,
    grams: null,
    quickKcal: 30,
  });
});

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(at(13, 15));
  mockPush.mockClear();
});
afterEach(() => jest.restoreAllMocks());

describe('Save as thali', () => {
  it('saves a meal’s foods and amounts under a name, leaving out quick adds', async () => {
    useLogStore.setState({ day: YESTERDAY });
    await render(<LogScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByRole('button', { name: 'Save Lunch as a thali' }));
    expect(screen.getByRole('header', { name: 'Save Lunch as a thali' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Lunch thali');
    expect(screen.getAllByText('2 medium roti')).toHaveLength(2); // in the meal and in the sheet
    expect(screen.getByText('Quick adds aren’t saved in a thali.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Sunday lunch');
    await fireEvent.press(screen.getByRole('button', { name: 'Save thali' }));
    await act(async () => {});

    const [thali] = await listThalis();
    expect(thali.name).toBe('Sunday lunch');
    expect(thali.items.map((i) => [i.name, i.qty, i.unit, i.oilLevel])).toEqual([
      ['Mixed dal', 1, 'katori', 1],
      ['Chapati/Roti', 2, 'roti_m', 0],
    ]);
    expect(useUndoStore.getState().current?.message).toBe('Saved Sunday lunch');
  });
});

describe('Logging a thali from Add food', () => {
  it('opens a checklist: untick, change an amount, and log all at once with one Undo', async () => {
    useLogStore.setState({ day: TODAY });
    await render(<AddFoodScreen />);
    await act(async () => {});
    await fireEvent.press(screen.getByRole('radio', { name: 'Thalis' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Sunday lunch, 2 items · / }));

    expect(screen.getByRole('checkbox', { name: 'Include Mixed dal', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Include Chapati/Roti' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More, Mixed dal' }));
    expect(screen.getByText('1.25 katori')).toBeOnTheScreen();
    // 1.25 katori = 187.5 g of dal, with the oil level it was saved with (More).
    const kcal = ((dalKcal + dalOilKcal) * 187.5) / 100;
    expect(screen.getByText(`Selected: ${Math.round(kcal)} kcal`)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Log 1 item to Lunch' }));
    await act(async () => {});

    expect(await listEntriesForDay(TODAY)).toMatchObject([
      {
        name: 'Mixed dal',
        slotId: 'lunch',
        qty: 1.25,
        unit: 'katori',
        grams: 187.5,
        oilLevel: 1,
        loggedAt: at(13, 15),
        batchId: expect.any(String),
      },
    ]);
    expect(useUndoStore.getState().current?.message).toBe('Added 1 item to Lunch');
    await act(() => useUndoStore.getState().undo());
    expect(await listEntriesForDay(TODAY)).toEqual([]);
  });

  it('logs every item of the thali in one batch', async () => {
    useLogStore.setState({ day: TODAY });
    await render(<AddFoodScreen />);
    await act(async () => {});
    await fireEvent.press(screen.getByRole('radio', { name: 'Thalis' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Sunday lunch/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log 2 items to Lunch' }));
    await act(async () => {});

    const entries = await listEntriesForDay(TODAY);
    expect(entries.map((e) => e.name)).toEqual(['Mixed dal', 'Chapati/Roti']);
    expect(new Set(entries.map((e) => e.batchId)).size).toBe(1);
    await act(() => useUndoStore.getState().undo());
  });
});

describe('My foods tab', () => {
  it('lists the person’s recipes, ready to log, with a New recipe button', async () => {
    await saveRecipe({
      name: 'Poha (home)',
      servings: 2,
      cookedWeightG: null,
      servingLabel: 'serving',
      items: [
        {
          foodSource: 'base',
          foodId: '1',
          name: 'Poha',
          qty: 100,
          unit: 'g',
          grams: 100,
          isFat: false,
          nutrients: { ...emptyNutrients(), energy_kcal: 350 },
        },
      ],
    });
    useLogStore.setState({ day: TODAY });
    await render(<AddFoodScreen />);
    await act(async () => {});
    await fireEvent.press(screen.getByRole('radio', { name: 'My foods' }));

    expect(
      screen.getByRole('button', { name: 'Poha (home), 1 serving · 175 kcal' }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'New recipe' }));
    expect(mockPush).toHaveBeenCalledWith('/recipe');
  });
});
