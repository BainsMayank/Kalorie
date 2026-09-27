import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { insertEntry, type NewEntry } from '@/db/user/entries';
import { useLogStore } from '@/stores/log';

import { TodayScreen } from './TodayScreen';

// Only quick adds here, so every number is known; food entries are covered by the Log tab tests.
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
const at = (day: number, h: number, min = 0) => new Date(2026, 8, day, h, min).getTime();

function quick(
  day: number,
  slotId: string,
  loggedAt: number,
  name: string,
  kcal: number,
  macros: { p?: number; c?: number; f?: number } = {},
): NewEntry {
  return {
    foodSource: 'quick',
    foodId: null,
    day: `2026-09-${day}`,
    loggedAt,
    slotId,
    name,
    qty: null,
    unit: null,
    grams: null,
    quickKcal: kcal,
    quickProteinG: macros.p ?? null,
    quickCarbG: macros.c ?? null,
    quickFatG: macros.f ?? null,
  };
}

beforeAll(async () => {
  await useLogStore.getState().load();
  // Today: 700 kcal · protein 31 g · carbs 60 g · fat 36 g.
  await insertEntry(quick(27, 'breakfast', at(27, 8, 30), 'Poha', 300, { p: 6, c: 50, f: 8 }));
  await insertEntry(quick(27, 'lunch', at(27, 13), 'Paneer tikka', 400, { p: 25, c: 10, f: 28 }));
  // The 25th: a big day, more than planned.
  await insertEntry(quick(25, 'dinner', at(25, 21), 'Wedding buffet', 2300));
  // Nothing on the 26th.
});

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(at(27, 15));
  useLogStore.setState({ day: TODAY });
  mockPush.mockClear();
});
afterEach(() => jest.restoreAllMocks());

async function renderToday() {
  await render(<TodayScreen />);
  await act(async () => {}); // let the entries load
}

describe('Today tab', () => {
  it('shows the day with the calorie ring: eaten, target and what’s left', async () => {
    await renderToday();

    expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
    expect(screen.getByText('Sun, 27 Sep')).toBeOnTheScreen();
    expect(
      screen.getByRole('image', { name: '700 of 2,000 kcal eaten. 1,300 kcal left' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('1,300 kcal left')).toBeOnTheScreen();
    // The targets are placeholders until goals exist (Stage 5), and the screen says so.
    expect(screen.getByText(/sample targets/)).toBeOnTheScreen();
  });

  it('shows grams eaten vs target and each macro’s share of calories', async () => {
    await renderToday();

    // Energy from macros: protein 124 + carbs 240 + fat 324 = 688 kcal.
    expect(
      screen.getByLabelText('Protein: 31 of 60 g, 18% of calories from macros'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Carbs: 60 of 250 g, 35% of calories from macros'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Fat: 36 of 65 g, 47% of calories from macros')).toBeOnTheScreen();
  });

  it('lists the top foods for each macro, with grams and % of that macro', async () => {
    await renderToday();

    expect(screen.getByRole('header', { name: 'Top contributors' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: "Protein from Paneer tikka: 25 g, 81% of the day's total",
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: "Protein from Poha: 6 g, 19% of the day's total" }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: "Carbs from Poha: 50 g, 83% of the day's total" }),
    ).toBeOnTheScreen();
  });

  it('opens a food’s log entry when it is tapped in Top contributors', async () => {
    await renderToday();
    await fireEvent.press(screen.getByRole('button', { name: /^Fat from Paneer tikka/ }));
    expect(screen.getByRole('header', { name: 'Edit quick add' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories')).toHaveDisplayValue('400');
  });

  it('shows each meal with its time, foods and calories', async () => {
    await renderToday();

    const breakfast = screen.getByRole('header', { name: 'Breakfast' }).parent!.parent!.parent!;
    expect(within(breakfast).getByText('8:30 am')).toBeOnTheScreen();
    expect(within(breakfast).getAllByText('300 kcal').length).toBeGreaterThan(0);
    expect(within(breakfast).getByRole('button', { name: 'Poha, 300 kcal' })).toBeOnTheScreen();

    // Tapping a food in the timeline opens its entry too.
    await fireEvent.press(screen.getByRole('button', { name: 'Paneer tikka, 400 kcal' }));
    expect(screen.getByRole('header', { name: 'Edit quick add' })).toBeOnTheScreen();
  });

  it('shows a calm "more than planned" on a big day, never an alarm', async () => {
    useLogStore.setState({ day: '2026-09-25' });
    await renderToday();

    expect(screen.getByText('300 kcal more than planned')).toBeOnTheScreen();
    expect(
      screen.getByRole('image', {
        name: '2,300 of 2,000 kcal eaten. 300 kcal more than planned',
      }),
    ).toBeOnTheScreen();
  });

  it('steps back a day with ‹ and forward with ›, but not past today', async () => {
    await renderToday();
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
    await act(async () => {});
    expect(screen.getByRole('header', { name: 'Yesterday' })).toBeOnTheScreen();
    expect(useLogStore.getState().day).toBe('2026-09-26');

    await fireEvent.press(screen.getByRole('button', { name: 'Next day' }));
    await act(async () => {});
    expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
  });

  it('opens the calendar from the day’s name', async () => {
    await renderToday();
    await fireEvent.press(screen.getByRole('button', { name: 'Today, Sun, 27 Sep' }));
    expect(screen.getByRole('header', { name: 'Pick a date' })).toBeOnTheScreen();
  });

  it('shows a friendly empty state for a day with nothing logged', async () => {
    useLogStore.setState({ day: '2026-09-26' });
    await renderToday();

    expect(screen.getByRole('header', { name: 'A fresh page' })).toBeOnTheScreen();
    expect(screen.getByText(/You can still add meals to it/)).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: /^0 of 2,000 kcal eaten/ })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Top contributors' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Add food' }));
    expect(mockPush).toHaveBeenCalledWith('/add');
  });

  it('reads the day again on pull to refresh', async () => {
    useLogStore.setState({ day: '2026-09-20' });
    await renderToday();
    expect(screen.getByRole('header', { name: 'A fresh page' })).toBeOnTheScreen();

    // Saved without telling the screen (as another screen or a restore might).
    await insertEntry(quick(20, 'snacks', at(20, 17), 'Samosa', 260, { p: 4, c: 30, f: 14 }));
    const { refreshControl } = screen.getByTestId('today-scroll').props;
    await act(() => refreshControl.props.onRefresh());

    expect(screen.getByRole('button', { name: 'Samosa, 260 kcal' })).toBeOnTheScreen();
    expect(screen.getByText('1,740 kcal left')).toBeOnTheScreen();
  });
});
