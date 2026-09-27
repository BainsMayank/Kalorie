import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { FoodSearchScreen } from './FoodSearchScreen';
import { SEARCH_DEBOUNCE_MS } from './useFoodSearch';

// Search runs on the real foods.db through Node's SQLite, instead of the copy on the phone.
jest.mock('@/db/foods/client', () => {
  const { openFoodsDbForTests } = jest.requireActual('@/db/foods/testing');
  const db = openFoodsDbForTests();
  return { getFoodsDb: async () => db };
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

  it('opens the food when a result is tapped', async () => {
    await render(<FoodSearchScreen />);
    await typeSearch('dahi');

    await fireEvent.press(screen.getByRole('button', { name: /^Yogurt, plain, whole milk,/ }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/food/[id]',
      params: { id: expect.stringMatching(/^\d+$/) },
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
});
