import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getFoodDetail, searchFoods } from '@/db/foods';
import { openFoodsDbForTests } from '@/db/foods/testing';
import { listEntriesForDay } from '@/db/user/entries';
import { useLogStore } from '@/stores/log';

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
// user.db: a fresh in-memory database built from the real migrations.
jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});
let mockId = '';
let mockSlot: string | undefined;
let mockLog: string | undefined;
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockId, slot: mockSlot, log: mockLog }),
  useRouter: () => ({ back: mockBack, canGoBack: () => true }),
}));

const db = openFoodsDbForTests();
afterAll(() => db.close());

// "Now" is Sunday 27 September 2026, 1:15 pm: lunch time.
const NOW = new Date(2026, 8, 27, 13, 15).getTime();
beforeAll(() => useLogStore.getState().load());
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mockSlot = undefined;
  mockLog = undefined;
  mockBack.mockClear();
  useLogStore.setState({ day: '2026-09-27' });
});
afterEach(() => jest.restoreAllMocks());

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

describe('Adding to the log', () => {
  /** Newest entry on a day. */
  async function lastEntry(day = '2026-09-27') {
    const entries = await listEntriesForDay(day);
    return entries.sort((a, b) => a.createdAt - b.createdAt).at(-1);
  }

  it('logs 1 katori of dal to Lunch at the time now, with its grams', async () => {
    await openFood('daal');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to log' }));

    // The sheet starts with the amount from the food screen and the slot for 1:15 pm.
    expect(screen.getByRole('radio', { name: 'Lunch', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Time, 1:15 pm' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Log to Lunch' }));

    expect(await lastEntry()).toMatchObject({
      name: 'Mixed dal',
      slotId: 'lunch',
      foodSource: 'base',
      qty: 1,
      unit: 'katori',
      grams: 150,
      loggedAt: NOW - (NOW % 60_000),
    });
    expect(mockBack).toHaveBeenCalled(); // back to the search for the next food
  });

  it('opens the sheet straight away when coming from Add food', async () => {
    mockLog = '1';
    await openFood('daal');
    expect(screen.getByRole('button', { name: 'Log to Lunch' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Log to Lunch' }));
    expect(await lastEntry()).toMatchObject({ name: 'Mixed dal', qty: 1, unit: 'katori' });
  });

  it('logs half a medium roti (0.5 steps)', async () => {
    await openFood('roti');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to log' }));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Less' }).at(-1)!);
    await fireEvent.press(screen.getByRole('button', { name: 'Log to Lunch' }));

    expect(await lastEntry()).toMatchObject({ qty: 0.5, unit: 'roti_m', grams: 17.5 });
  });

  it('moves to Dinner when the time is changed to 8 pm', async () => {
    await openFood('daal');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to log' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Time, 1:15 pm' }));
    await fireEvent.press(screen.getByRole('radio', { name: '8 pm' }));
    await fireEvent.press(screen.getByRole('radio', { name: ':30' }));

    expect(screen.getByRole('radio', { name: 'Dinner', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Log to Dinner' }));
    expect(await lastEntry()).toMatchObject({
      slotId: 'dinner',
      loggedAt: new Date(2026, 8, 27, 20, 30).getTime(),
    });
  });

  it('keeps a slot the user picked when the time changes', async () => {
    await openFood('daal');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to log' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Snacks' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Time, 1:15 pm' }));
    await fireEvent.press(screen.getByRole('radio', { name: '9 am' }));

    expect(screen.getByRole('radio', { name: 'Snacks', checked: true })).toBeOnTheScreen();
  });

  it('uses the slot "+ Add" was tapped on, at its start time', async () => {
    mockSlot = 'dinner';
    await openFood('daal');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to log' }));

    expect(screen.getByRole('radio', { name: 'Dinner', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Time, 7:00 pm' })).toBeOnTheScreen();
  });

  it('logs to the day picked in the Log tab, and says which day', async () => {
    useLogStore.setState({ day: '2026-09-26' });
    await openFood('daal');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to log' }));
    expect(screen.getByText('For Yesterday')).toBeOnTheScreen();

    // 1:00 am belongs to the day before, so it is saved on the next calendar date.
    await fireEvent.press(screen.getByRole('button', { name: 'Time, 1:15 pm' }));
    await fireEvent.press(screen.getByRole('radio', { name: '1 am' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log to Dinner' }));

    expect(await lastEntry('2026-09-26')).toMatchObject({
      day: '2026-09-26',
      loggedAt: new Date(2026, 8, 27, 1, 15).getTime(),
    });
  });
});

describe('Oil / ghee on the Add sheet', () => {
  it('offers Less · Normal · More for a dish cooked with oil, changing only fat and kcal', async () => {
    const [dal] = await searchFoods(db, 'daal');
    const food = (await getFoodDetail(db, dal.id))!;
    const step = food.oilStep!; // Mixed dal: its recipe has oil
    const per100 = await openFood('daal');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to log' }));

    expect(screen.getByText('Oil / ghee')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Normal', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'More' }));

    // 1 katori = 150 g: one step more oil on 150 g of dal.
    const more = (per100 * 150) / 100 + (step.energy_kcal * 150) / 100;
    expect(screen.getByText(kcalText(more))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Log to Lunch' }));

    // (Every entry in these tests is made at the same "now", so find it by its oil level.)
    const withOil = (await listEntriesForDay('2026-09-27')).filter((e) => e.oilLevel !== 0);
    expect(withOil).toEqual([
      expect.objectContaining({
        name: 'Mixed dal',
        grams: 150, // the same katori — just more oil in it
        oilLevel: 1,
      }),
    ]);
  });

  it('has no oil control for a food without cooking fat', async () => {
    await openFood('dahi');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to log' }));
    expect(screen.queryByText('Oil / ghee')).toBeNull();
  });
});
