import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { getFoodDetail, searchFoods } from '@/db/foods';
import { openFoodsDbForTests } from '@/db/foods/testing';
import { insertEntry, listEntriesForDay } from '@/db/user/entries';
import { useLogStore } from '@/stores/log';
import { useUndoStore } from '@/stores/undo';

import { LogScreen } from './LogScreen';

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
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const foodsDb = openFoodsDbForTests();
afterAll(() => foodsDb.close());

const TODAY = '2026-09-27';
const at = (h: number, min = 0) => new Date(2026, 8, 27, h, min).getTime();

let dalKcal = 0; // kcal per 100 g
let rotiKcal = 0;

beforeAll(async () => {
  await useLogStore.getState().load();
  const [dal] = await searchFoods(foodsDb, 'daal');
  const [roti] = await searchFoods(foodsDb, 'roti');
  dalKcal = (await getFoodDetail(foodsDb, dal.id))!.nutrients.energy_kcal!;
  rotiKcal = (await getFoodDetail(foodsDb, roti.id))!.nutrients.energy_kcal!;

  const base = { foodSource: 'base' as const, day: TODAY };
  await insertEntry({
    ...base,
    loggedAt: at(13, 0),
    slotId: 'lunch',
    foodId: String(dal.id),
    name: 'Mixed dal',
    qty: 1,
    unit: 'katori',
    grams: 150,
  });
  await insertEntry({
    ...base,
    loggedAt: at(13, 5),
    slotId: 'lunch',
    foodId: String(roti.id),
    name: 'Chapati/Roti',
    qty: 2,
    unit: 'roti_m',
    grams: 70,
  });
  await insertEntry({
    ...base,
    day: '2026-09-26',
    loggedAt: at(8, 0) - 86_400_000,
    slotId: 'breakfast',
    foodId: String(roti.id),
    name: 'Chapati/Roti',
    qty: 1,
    unit: 'roti_m',
    grams: 35,
  });
});

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(at(15, 0));
  useLogStore.setState({ day: TODAY });
  mockPush.mockClear();
});
afterEach(() => jest.restoreAllMocks());

const kcal = (value: number) => `${Math.round(value).toLocaleString('en-US')} kcal`;

async function renderLog() {
  await render(<LogScreen />);
  await act(async () => {}); // let the entries load
}

/** The card for a meal slot, found by its heading. */
function slotCard(name: string) {
  return screen.getByRole('header', { name }).parent!.parent!.parent!;
}

describe('Log tab', () => {
  it('groups the day’s entries by meal slot, with kcal per entry, slot and day', async () => {
    await renderLog();

    const dal = (dalKcal * 150) / 100;
    const roti = (rotiKcal * 70) / 100;
    expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: `Mixed dal, 1 katori, ${kcal(dal)}` }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: `Chapati/Roti, 2 medium roti, ${kcal(roti)}` }),
    ).toBeOnTheScreen();

    const lunch = slotCard('Lunch');
    expect(within(lunch).getByText(kcal(dal + roti))).toBeOnTheScreen();
    expect(screen.getByText(`Total ${kcal(dal + roti)}`)).toBeOnTheScreen(); // the whole day
    // Empty slots still show, ready for "+ Add".
    expect(within(slotCard('Dinner')).getByText('Nothing logged here yet.')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Breakfast' })).toBeOnTheScreen();
  });

  it('opens food search for a slot from its + Add button', async () => {
    await renderLog();
    await fireEvent.press(screen.getByRole('button', { name: 'Add food to Dinner' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/add', params: { slot: 'dinner' } });
  });

  it('switches to yesterday and back to today', async () => {
    await renderLog();
    await fireEvent.press(screen.getByRole('button', { name: 'Yesterday' }));
    await act(async () => {});

    expect(screen.getByRole('header', { name: 'Yesterday' })).toBeOnTheScreen();
    expect(screen.getByText('Sat, 26 Sep')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Chapati\/Roti, 1 medium roti/ })).toBeOnTheScreen();
    expect(screen.queryByText('Mixed dal')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
    await act(async () => {});
    expect(screen.getByText('Mixed dal')).toBeOnTheScreen();
  });

  it('opens the calendar to pick a date', async () => {
    await renderLog();
    await fireEvent.press(screen.getByRole('button', { name: 'Pick a date' }));
    expect(screen.getByRole('header', { name: 'Pick a date' })).toBeOnTheScreen();
  });

  it('edits an entry: 2 katori of dal instead of 1', async () => {
    await renderLog();
    await fireEvent.press(screen.getByRole('button', { name: /^Mixed dal, 1 katori/ }));
    await act(async () => {}); // the food loads
    expect(screen.getByRole('header', { name: 'Edit entry' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Lunch', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Time, 1:00 pm' })).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Amount'), '2');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await act(async () => {});

    expect(
      screen.getByRole('button', { name: `Mixed dal, 2 katori, ${kcal((dalKcal * 300) / 100)}` }),
    ).toBeOnTheScreen();
    const dal = (await listEntriesForDay(TODAY)).find((e) => e.name === 'Mixed dal');
    expect(dal).toMatchObject({ qty: 2, grams: 300 });
  });

  it('deletes an entry with the row’s delete action (the same as swiping left)', async () => {
    await renderLog();
    const row = screen.getByRole('button', { name: /^Chapati\/Roti, 2 medium roti/ });
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    await act(async () => {});

    expect(screen.queryByText('Chapati/Roti')).toBeNull();
    // Soft delete: gone from the day, still in the database.
    expect((await listEntriesForDay(TODAY)).map((e) => e.name)).toEqual(['Mixed dal']);
  });

  it('deletes an entry from the Edit sheet', async () => {
    await renderLog();
    await fireEvent.press(screen.getByRole('button', { name: /^Mixed dal/ }));
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await act(async () => {});

    expect(screen.queryByText('Mixed dal')).toBeNull();
    expect(within(slotCard('Lunch')).getByText('Nothing logged here yet.')).toBeOnTheScreen();
  });

  it('brings a deleted entry back from Recently deleted', async () => {
    await renderLog();
    await act(async () => {}); // the deleted list loads after the day
    // Both lunch entries were deleted above.
    await fireEvent.press(screen.getByRole('button', { name: 'Recently deleted (2)' }));
    expect(screen.getByRole('header', { name: 'Recently deleted' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Bring back Mixed dal' }));
    await act(async () => {});

    // One item is left, so the sheet stays open; close it to see the day.
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    // It comes back as it was when deleted (2 katori, from the edit above).
    expect(screen.getByRole('button', { name: /^Mixed dal, 2 katori/ })).toBeOnTheScreen();
    expect((await listEntriesForDay(TODAY)).map((e) => e.name)).toEqual(['Mixed dal']);
    expect(screen.getByRole('button', { name: 'Recently deleted (1)' })).toBeOnTheScreen();
  });

  it('lets an entry whose food is gone be deleted', async () => {
    await insertEntry({
      day: TODAY,
      loggedAt: at(19, 0),
      slotId: 'dinner',
      foodSource: 'base',
      foodId: '1',
      name: 'Old food',
      qty: 1,
      unit: 'katori',
      grams: 150,
    });
    await renderLog();
    await fireEvent.press(screen.getByRole('button', { name: /^Old food/ }));
    await act(async () => {});
    expect(screen.getByText(/isn't in Kalorie any more/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await act(async () => {});
    expect(screen.queryByText('Old food')).toBeNull();
  });
});

describe('Log tab — copy, Undo and quick adds', () => {
  const DAY = '2026-09-15';
  const on15 = (h: number, min = 0) => new Date(2026, 8, 15, h, min).getTime();

  beforeAll(async () => {
    const [dal] = await searchFoods(foodsDb, 'daal');
    const base = { foodSource: 'base' as const, day: DAY, foodId: String(dal.id), unit: 'katori' };
    await insertEntry(
      { ...base, loggedAt: on15(8), slotId: 'breakfast', name: 'Mixed dal', qty: 0.5, grams: 75 },
      1,
    );
    await insertEntry(
      { ...base, loggedAt: on15(13), slotId: 'lunch', name: 'Mixed dal', qty: 1, grams: 150 },
      2,
    );
    await insertEntry(
      {
        foodSource: 'quick',
        foodId: null,
        day: DAY,
        loggedAt: on15(21),
        slotId: 'dinner',
        name: '',
        qty: null,
        unit: null,
        grams: null,
        quickKcal: 450,
      },
      3,
    );
  });

  beforeEach(() => {
    useLogStore.setState({ day: DAY });
    useUndoStore.getState().dismiss();
  });

  it('shows a quick add with its calories, called "Quick add" when it has no label', async () => {
    await renderLog();
    expect(screen.getByRole('button', { name: 'Quick add, 450 kcal' })).toBeOnTheScreen();
  });

  it('opens the quick-add form to edit it', async () => {
    await renderLog();
    await fireEvent.press(screen.getByRole('button', { name: 'Quick add, 450 kcal' }));
    expect(screen.getByRole('header', { name: 'Edit quick add' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Calories'), '500');
    await fireEvent.changeText(screen.getByLabelText('Label (optional)'), 'Wedding buffet');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Wedding buffet, 500 kcal' })).toBeOnTheScreen();
  });

  it('brings a swiped-away entry back with Undo', async () => {
    await renderLog();
    const row = screen.getByRole('button', { name: /^Wedding buffet/ });
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    await act(async () => {});
    expect(screen.queryByText('Wedding buffet')).toBeNull();
    expect(useUndoStore.getState().current?.message).toBe('Removed Wedding buffet');

    await act(() => useUndoStore.getState().undo());
    expect(screen.getByText('Wedding buffet')).toBeOnTheScreen();
  });

  it('copies one meal to another day and slot', async () => {
    await renderLog();
    await fireEvent.press(screen.getByRole('button', { name: 'Copy Lunch' }));
    expect(screen.getByRole('header', { name: 'Copy Lunch to…' })).toBeOnTheScreen();
    // Copying a past day's meal goes to today by default; pick Tomorrow and Dinner instead.
    expect(screen.getByRole('button', { name: 'Today', selected: true })).toBeOnTheScreen();
    const sheetDays = screen.getAllByRole('button', { name: 'Tomorrow' });
    await fireEvent.press(sheetDays[sheetDays.length - 1]);
    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Copy 1 item' }));
    await act(async () => {});

    expect(await listEntriesForDay('2026-09-28')).toMatchObject([
      {
        name: 'Mixed dal',
        slotId: 'dinner',
        qty: 1,
        grams: 150,
        loggedAt: new Date(2026, 8, 28, 19).getTime(),
      },
    ]);
    expect(useUndoStore.getState().current?.message).toBe('Copied 1 item to Mon, 28 Sep');

    await act(() => useUndoStore.getState().undo());
    expect(await listEntriesForDay('2026-09-28')).toEqual([]);
  });

  it('copies the whole day, each entry to its own slot at the same time', async () => {
    await renderLog();
    await fireEvent.press(screen.getByRole('button', { name: 'Copy day' }));
    expect(screen.getByRole('header', { name: 'Copy this day to…' })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'Dinner' })).toBeNull(); // no slot for a whole day
    await fireEvent.press(screen.getByRole('button', { name: 'Copy 3 items' }));
    await act(async () => {});

    const copies = await listEntriesForDay(TODAY);
    const fromThe15th = copies.filter((e) => e.batchId !== null);
    expect(fromThe15th.map((e) => [e.slotId, e.name, e.loggedAt])).toEqual([
      ['breakfast', 'Mixed dal', at(8)],
      ['lunch', 'Mixed dal', at(13)],
      ['dinner', 'Wedding buffet', at(21)],
    ]);
    expect(new Set(fromThe15th.map((e) => e.batchId)).size).toBe(1);
  });
});
