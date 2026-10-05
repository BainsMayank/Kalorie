import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getFoodDetail, searchFoods } from '@/db/foods';
import { openFoodsDbForTests } from '@/db/foods/testing';
import { insertEntry as insertEntryAt, listEntriesForDay } from '@/db/user/entries';
import { listFavourites } from '@/db/user/favourites';
import { useFavouritesStore } from '@/stores/favourites';
import { useLogStore } from '@/stores/log';
import { useUndoStore } from '@/stores/undo';

import { AddFoodScreen } from './AddFoodScreen';

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
let mockSlot: string | undefined;
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ slot: mockSlot }),
  useRouter: () => ({ push: mockPush }),
}));

const foodsDb = openFoodsDbForTests();
afterAll(() => foodsDb.close());

const TODAY = '2026-09-27';
// "Now" is 1:15 pm: lunch time.
const NOW = new Date(2026, 8, 27, 13, 15).getTime();
const dayAt = (daysAgo: number, h: number) => new Date(2026, 8, 27 - daysAgo, h).getTime();
const iso = (daysAgo: number) => `2026-09-${String(27 - daysAgo).padStart(2, '0')}`;

let dal: { id: number; kcal: number };
let roti: { id: number; kcal: number };

async function food(query: string) {
  const [first] = await searchFoods(foodsDb, query);
  return { id: first.id, kcal: (await getFoodDetail(foodsDb, first.id))!.nutrients.energy_kcal! };
}

beforeAll(async () => {
  await useLogStore.getState().load();
  await useFavouritesStore.getState().load();
  dal = await food('daal');
  roti = await food('roti');
});

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mockSlot = undefined;
  mockPush.mockClear();
  useLogStore.setState({ day: TODAY });
});
afterEach(() => jest.restoreAllMocks());

/** Lets the lists load. */
async function settle() {
  await act(async () => {});
}

async function renderAdd() {
  await render(<AddFoodScreen />);
  await settle();
}

const kcal = (value: number) => Math.round(value).toLocaleString('en-US');

describe('Add food — before any food is logged', () => {
  it('picks the slot by the time now, and shows the search hint', async () => {
    await renderAdd();
    expect(screen.getByRole('radio', { name: 'Lunch', checked: true })).toBeOnTheScreen();
    expect(screen.getByText(/Daal, bhindi and dahi all work/)).toBeOnTheScreen();
  });

  it('suggests starter foods for the slot (data/curated/slot_suggestions.csv)', async () => {
    await renderAdd();
    expect(screen.getByRole('header', { name: 'Often at Lunch' })).toBeOnTheScreen();
    const suggested = screen.getAllByRole('button', { name: /^Add .* to Lunch$/ });
    expect(suggested[0]).toHaveAccessibleName('Add 1 medium roti Chapati/Roti to Lunch');
    expect(suggested[1]).toHaveAccessibleName('Add 1 katori Mixed dal to Lunch');
  });

  it('offers the starter thalis, which can’t be deleted', async () => {
    await renderAdd();
    await fireEvent.press(screen.getByRole('radio', { name: 'Thalis' }));
    expect(screen.getByText(/Save any meal as a thali/)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Starter thalis' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Simple dal-chawal, 3 items/ }));
    expect(screen.getByRole('header', { name: 'Simple dal-chawal' })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Include Mixed dal' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Log 3 items to Lunch' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Delete thali' })).toBeNull();
  });
});

describe('Add food — suggestions, recents and favourites', () => {
  beforeAll(async () => {
    // Each entry is made a moment after the one before, like on the phone.
    let created = dayAt(10, 12);
    const insertEntry = (entry: Parameters<typeof insertEntryAt>[0]) =>
      insertEntryAt(entry, (created += 60_000));
    // Lunch lately: dal most days at 1 katori, roti twice at 2; breakfast: roti once.
    const base = { foodSource: 'base' as const, slotId: 'lunch', unit: 'katori' };
    for (const daysAgo of [1, 2, 3]) {
      await insertEntry({
        ...base,
        day: iso(daysAgo),
        loggedAt: dayAt(daysAgo, 13),
        foodId: String(dal.id),
        name: 'Mixed dal',
        qty: 1,
        grams: 150,
      });
    }
    for (const daysAgo of [1, 4]) {
      await insertEntry({
        ...base,
        day: iso(daysAgo),
        loggedAt: dayAt(daysAgo, 13),
        foodId: String(roti.id),
        name: 'Chapati/Roti',
        qty: 2,
        unit: 'roti_m',
        grams: 70,
      });
    }
    await insertEntry({
      ...base,
      slotId: 'breakfast',
      day: iso(0),
      loggedAt: dayAt(0, 8),
      foodId: String(roti.id),
      name: 'Chapati/Roti',
      qty: 1,
      unit: 'roti_m',
      grams: 35,
    });
  });

  it('suggests what is usually eaten at lunch, most often first, at the usual amount', async () => {
    await renderAdd();
    expect(screen.getByRole('header', { name: 'Often at Lunch' })).toBeOnTheScreen();
    const rows = screen.getAllByRole('button', { name: /^(Mixed dal|Chapati\/Roti), / });
    expect(rows[0]).toHaveAccessibleName(`Mixed dal, 1 katori · ${kcal(dal.kcal * 1.5)} kcal`);
    expect(rows[1]).toHaveAccessibleName(
      `Chapati/Roti, 2 medium roti · ${kcal(roti.kcal * 0.7)} kcal`,
    );
  });

  it('adds a suggestion in one tap, and offers Undo', async () => {
    await renderAdd();
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Add 1 katori Mixed dal to Lunch' })[0],
    );
    await act(async () => {});

    const [entry] = (await listEntriesForDay(TODAY)).filter((e) => e.slotId === 'lunch');
    expect(entry).toMatchObject({
      foodId: String(dal.id),
      qty: 1,
      unit: 'katori',
      grams: 150,
      loggedAt: new Date(2026, 8, 27, 13, 15).getTime(),
    });
    expect(useUndoStore.getState().current?.message).toBe('Added Mixed dal to Lunch');

    await act(() => useUndoStore.getState().undo());
    expect((await listEntriesForDay(TODAY)).filter((e) => e.slotId === 'lunch')).toEqual([]);
  });

  it('changes the suggestions with the slot', async () => {
    await renderAdd();
    await fireEvent.press(screen.getByRole('radio', { name: 'Breakfast' }));
    await act(async () => {});
    expect(screen.getByRole('header', { name: 'Often at Breakfast' })).toBeOnTheScreen();
    // Roti is the only breakfast food so far, so starter foods fill the list after it.
    const suggested = screen.getAllByRole('button', { name: /^Add .* to Breakfast$/ });
    expect(suggested[0]).toHaveAccessibleName('Add 1 medium roti Chapati/Roti to Breakfast');
    expect(suggested[1]).toHaveAccessibleName('Add 1 tea cup Hot tea to Breakfast');
  });

  it('starts on the slot "+ Add" was tapped on', async () => {
    mockSlot = 'dinner';
    await renderAdd();
    expect(screen.getByRole('radio', { name: 'Dinner', checked: true })).toBeOnTheScreen();
    // Nothing eaten at dinner yet: starter foods, and Recent helps too.
    expect(screen.getByRole('header', { name: 'Often at Dinner' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Recent', checked: true })).toBeOnTheScreen();
  });

  it('suggests a food for a slot right after it is first logged there', async () => {
    mockSlot = 'snacks';
    const firstSuggestion = () => screen.getAllByRole('button', { name: /^Add .* to Snacks$/ })[0];
    await renderAdd();
    // Only starter foods at snacks so far: tea first.
    expect(firstSuggestion()).toHaveAccessibleName('Add 1 tea cup Hot tea to Snacks');
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Add 1 katori Mixed dal to Snacks' })[0],
    );
    await settle();
    expect(firstSuggestion()).toHaveAccessibleName('Add 1 katori Mixed dal to Snacks');
    await act(() => useUndoStore.getState().undo());
    await settle();
    expect(firstSuggestion()).toHaveAccessibleName('Add 1 tea cup Hot tea to Snacks');
  });

  it('lists recent foods at the amount used last time', async () => {
    mockSlot = 'dinner';
    await renderAdd();
    // Each shows twice: as a starter suggestion for dinner and under Recent.
    expect(
      screen.getAllByRole('button', { name: 'Add 1 medium roti Chapati/Roti to Dinner' }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('button', { name: 'Add 1 katori Mixed dal to Dinner' }),
    ).toHaveLength(2);
  });

  it('stars a food, which then shows in Favourites', async () => {
    mockSlot = 'dinner';
    await renderAdd();
    await fireEvent.press(screen.getByRole('radio', { name: 'Favourites' }));
    expect(screen.getByText('Tap ☆ on any food to keep it here.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Recent' }));
    // The last star is in the Recent list (the first is on its starter suggestion).
    const stars = screen.getAllByRole('button', { name: 'Add Mixed dal to favourites' });
    await fireEvent.press(stars[stars.length - 1]);
    await act(async () => {});
    expect(await listFavourites()).toMatchObject([{ foodSource: 'base', foodId: String(dal.id) }]);

    await fireEvent.press(screen.getByRole('radio', { name: 'Favourites' }));
    await act(async () => {});
    // In the suggestions and in Favourites, starred in both.
    expect(screen.getAllByRole('button', { name: /^Mixed dal, 1 katori/ })).toHaveLength(2);
    expect(
      screen.getAllByRole('button', { name: 'Remove Mixed dal from favourites' }),
    ).toHaveLength(2);
  });

  it('opens a food with the chosen slot, its Add to log sheet already up', async () => {
    await renderAdd();
    await fireEvent.press(screen.getAllByRole('button', { name: /^Mixed dal, / })[0]);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/food/[id]',
      params: { id: String(dal.id), slot: 'lunch', log: '1' },
    });
  });
});

describe('Quick add', () => {
  it('logs calories with a label and macros, without a food', async () => {
    await renderAdd();
    await fireEvent.press(screen.getByRole('button', { name: 'Quick add' }));
    const sheet = screen.getByRole('header', { name: 'Quick add' });
    expect(sheet).toBeOnTheScreen();

    const log = screen.getByRole('button', { name: 'Log to Lunch' });
    expect(log).toBeDisabled(); // calories are needed
    await fireEvent.changeText(screen.getByLabelText('Calories'), '300');
    await fireEvent.changeText(screen.getByLabelText('Protein'), '12');
    await fireEvent.changeText(screen.getByLabelText('Label (optional)'), 'Office samosa');
    await fireEvent.press(screen.getByRole('button', { name: 'Log to Lunch' }));
    await act(async () => {});

    const quick = (await listEntriesForDay(TODAY)).find((e) => e.foodSource === 'quick');
    expect(quick).toMatchObject({
      name: 'Office samosa',
      slotId: 'lunch',
      quickKcal: 300,
      quickProteinG: 12,
      quickCarbG: null,
      quickFatG: null,
      grams: null,
      foodId: null,
    });
    expect(screen.queryByRole('header', { name: 'Quick add' })).toBeNull();
    expect(useUndoStore.getState().current?.message).toBe('Added Office samosa to Lunch');
  });

  it('won’t log a macro that isn’t a number', async () => {
    await renderAdd();
    await fireEvent.press(screen.getByRole('button', { name: 'Quick add' }));
    await fireEvent.changeText(screen.getByLabelText('Calories'), '300');
    await fireEvent.changeText(screen.getByLabelText('Fat'), 'lots');
    expect(screen.getByRole('button', { name: 'Log to Lunch' })).toBeDisabled();
  });
});
