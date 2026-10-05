import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { saveRecipe } from '@/db/user/customFoods';
import { saveGroupFoods } from '@/db/user/groupFoods';
import { emptyNutrients } from '@/lib/nutrients';

import { FoodSearchScreen } from './FoodSearchScreen';
import { SEARCH_DEBOUNCE_MS } from './useFoodSearch';

// Search runs on the real foods.db through Node's SQLite, instead of the copy on the phone.
jest.mock('@/db/foods/client', () => {
  const { openFoodsDbForTests } = jest.requireActual('@/db/foods/testing');
  const db = openFoodsDbForTests();
  return { getFoodsDb: async () => db };
});
// The person's own foods (recipes, products) come from a fresh in-memory user.db.
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

/** Types into the search box and lets the debounce timer and the search finish. */
async function typeSearch(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Search foods'), text);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
  });
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('Food search screen', () => {
  it('shows a hint before anything is typed', async () => {
    await render(<FoodSearchScreen />);
    expect(screen.getByText(/Daal, bhindi and dahi all work/)).toBeOnTheScreen();
  });

  it('finds dal as you type "daal", with its source and usual portion', async () => {
    await render(<FoodSearchScreen />);
    await typeSearch('daal');

    const row = screen.getByRole('button', { name: /^Mixed dal, 1 katori · \d+ kcal$/ });
    expect(within(row).getByText('INDB')).toBeOnTheScreen();
  });

  it('opens the food with its Add to log sheet when a result is tapped', async () => {
    await render(<FoodSearchScreen />);
    await typeSearch('dahi');

    await fireEvent.press(screen.getByRole('button', { name: /^Yogurt, plain, whole milk,/ }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/food/[id]',
      params: { id: expect.stringMatching(/^\d+$/), log: '1' },
    });
  });

  it('waits until typing pauses before searching', async () => {
    await render(<FoodSearchScreen />);
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'daal');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 50);
    });
    expect(screen.queryByText('Mixed dal')).toBeNull();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText('Mixed dal')).toBeOnTheScreen();
  });

  it('says so when nothing matches', async () => {
    await render(<FoodSearchScreen />);
    await typeSearch('xqzvw');
    expect(screen.getByText(/Nothing found for “xqzvw”/)).toBeOnTheScreen();
  });

  it('finds the person’s own recipes first, with a My recipe tag, and opens them', async () => {
    const id = await saveRecipe({
      name: 'Dal tadka (mom)',
      servings: 4,
      cookedWeightG: 1000,
      servingLabel: 'serving',
      items: [
        {
          foodSource: 'base',
          foodId: '1',
          name: 'Toor dal',
          qty: 1,
          unit: 'cup',
          grams: 200,
          isFat: false,
          nutrients: { ...emptyNutrients(), energy_kcal: 340 },
        },
      ],
    });
    await render(<FoodSearchScreen slot="lunch" />);
    await typeSearch('dal tadka');

    // 680 kcal in 1000 g: one serving (250 g) = 170 kcal
    const row = screen.getByRole('button', { name: 'Dal tadka (mom), 1 serving · 170 kcal' });
    expect(within(row).getByText('My recipe')).toBeOnTheScreen();
    await fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/food/[id]',
      params: { id, source: 'custom', slot: 'lunch', log: '1' },
    });
  });

  it('finds foods shared in the group, with a Group tag and who shared them', async () => {
    await saveGroupFoods(
      [
        {
          id: '11111111-1111-4111-8111-111111111111',
          createdBy: 'asha',
          kind: 'recipe',
          name: 'Kadhi pakora (Asha)',
          brand: null,
          barcode: null,
          servingG: null,
          densityGPerMl: 1,
          cookedWithFat: true,
          nutrients: { ...emptyNutrients(), energy_kcal: 120 },
          units: [{ unit: 'serving', label: 'serving', grams: 200, isDefault: true }],
          updatedAt: 1,
        },
      ],
      new Map([['asha', 'Asha']]),
    );
    await render(<FoodSearchScreen />);
    await typeSearch('kadhi pakora');

    const row = screen.getByRole('button', {
      name: 'Kadhi pakora (Asha), 1 serving · 240 kcal, Shared by Asha',
    });
    expect(within(row).getByText('Group')).toBeOnTheScreen();
    expect(within(row).getByText('Shared by Asha')).toBeOnTheScreen();
  });

  it('calls onPick instead of opening the food when picking an ingredient', async () => {
    const onPick = jest.fn();
    mockPush.mockClear();
    await render(<FoodSearchScreen onPick={onPick} />);
    await typeSearch('daal');
    await fireEvent.press(screen.getByRole('button', { name: /^Mixed dal,/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mixed dal' }));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/Add Mixed dal to favourites/)).toBeNull();
  });
});
