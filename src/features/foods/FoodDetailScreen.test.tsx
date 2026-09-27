import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getFoodDetail, searchFoods } from '@/db/foods';
import { openFoodsDbForTests } from '@/db/foods/testing';

import { FoodDetailScreen } from './FoodDetailScreen';

// The screen reads the real foods.db through Node's SQLite, instead of the copy on the phone.
jest.mock('@/db/foods/client', () => {
  const { openFoodsDbForTests: open } = jest.requireActual('@/db/foods/testing');
  const db = open();
  return { getFoodsDb: async () => db };
});
jest.mock('@/db/user/settings', () => ({
  readAllSettings: jest.fn(async () => ({})),
  writeSetting: jest.fn(async () => {}),
}));
let mockId = '';
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: mockId }) }));

const db = openFoodsDbForTests();
afterAll(() => db.close());

/** Opens the detail screen for the first search result of `query`; returns its kcal per 100 g. */
async function openFood(query: string): Promise<number> {
  const [first] = await searchFoods(db, query);
  mockId = String(first.id);
  const food = await getFoodDetail(db, first.id);
  await render(<FoodDetailScreen />);
  await act(async () => {}); // let the food load
  return food!.nutrients.energy_kcal!;
}

const kcalText = (kcal: number) => `${Math.round(kcal).toLocaleString('en-US')} kcal`;

/** The portion's kcal shows twice: the big number and the Energy row of the table. */
function expectPortionKcal(kcal: number) {
  expect(screen.getAllByText(kcalText(kcal))).toHaveLength(2);
}

describe('Food detail screen', () => {
  it('shows the food with its usual portion: 1 katori of dal', async () => {
    const per100 = await openFood('daal');

    expect(screen.getByRole('header', { name: 'Mixed dal' })).toBeOnTheScreen();
    expect(screen.getByLabelText('From Indian Nutrient Databank')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'katori', checked: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Amount')).toHaveDisplayValue('1');
    expect(screen.getByText('≈ 150 g')).toBeOnTheScreen();
    expectPortionKcal(per100 * 1.5);
  });

  it('recalculates for 2 medium roti', async () => {
    const per100 = await openFood('roti');
    expect(screen.getByRole('radio', { name: 'medium roti', checked: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'More' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More' }));

    expect(screen.getByLabelText('Amount')).toHaveDisplayValue('2');
    expect(screen.getByText('≈ 70 g')).toBeOnTheScreen();
    expectPortionKcal((per100 * 70) / 100);
  });

  it('recalculates for 150 g typed in, keeping the amount when switching to grams', async () => {
    const per100 = await openFood('daal');

    await fireEvent.press(screen.getByRole('radio', { name: 'g' }));
    expect(screen.getByLabelText('Amount')).toHaveDisplayValue('150'); // 1 katori = 150 g

    await fireEvent.changeText(screen.getByLabelText('Amount'), '200');
    expectPortionKcal((per100 * 200) / 100);
  });

  it('starts at 1 when switching to another unit', async () => {
    await openFood('roti');
    await fireEvent.press(screen.getByRole('radio', { name: 'large roti' }));
    expect(screen.getByLabelText('Amount')).toHaveDisplayValue('1');
    expect(screen.getByText('≈ 50 g')).toBeOnTheScreen();
  });

  it('shows unknown nutrients as — (not 0)', async () => {
    await openFood('daal');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText(/— means the data for this food doesn’t include it/)).toBeOnTheScreen();
  });

  it('says so for a food that does not exist', async () => {
    mockId = '1';
    await render(<FoodDetailScreen />);
    await act(async () => {});
    expect(screen.getByText("This food couldn't be found.")).toBeOnTheScreen();
  });
});
