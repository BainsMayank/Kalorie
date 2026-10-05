import '@/i18n';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react-native';

import { insertEntry, type NewEntry } from '@/db/user/entries';
import { saveTargets } from '@/db/user/goals';
import { notifyNow } from '@/features/alerts/notifications';
import type { TargetValues } from '@/lib/targets';
import { useGoalsStore } from '@/stores/goals';
import { useLogStore } from '@/stores/log';
import { useSettingsStore } from '@/stores/settings';

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
jest.mock('@/features/alerts/notifications', () => ({
  notifyNow: jest.fn(async () => {}),
  requestNotificationPermission: jest.fn(async () => true),
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

/** Stage 4's sample numbers, now saved as a real targets row. */
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

beforeAll(async () => {
  await useLogStore.getState().load();
  await saveTargets('2026-09-01', TARGETS, false);
  await useGoalsStore.getState().load();
  // Today: 700 kcal · protein 31 g · carbs 60 g · fat 36 g.
  await insertEntry(quick(27, 'breakfast', at(27, 8, 30), 'Poha', 300, { p: 6, c: 50, f: 8 }));
  await insertEntry(quick(27, 'lunch', at(27, 13), 'Paneer tikka', 400, { p: 25, c: 10, f: 28 }));
  // The 25th: a big day, more than planned.
  await insertEntry(quick(25, 'dinner', at(25, 21), 'Wedding buffet', 2300));
  // Nothing on the 26th.
});

/** A targets row for the store, as if read from user.db. */
function targetsRow(values: TargetValues) {
  return {
    id: 'targets',
    effectiveFrom: '2026-09-01',
    kcal: values.kcal,
    proteinG: values.protein_g,
    carbG: values.carb_g,
    fatG: values.fat_g,
    fibreG: values.fibre_g,
    sodiumMgLimit: values.sodium_mg_limit,
    sugarGLimit: values.sugar_g_limit,
    satFatGLimit: values.sat_fat_g_limit,
    fatGLimit: values.fat_g_limit,
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  };
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(at(27, 15));
  useLogStore.setState({ day: TODAY });
  useGoalsStore.setState({ targetRows: [targetsRow(TARGETS)] });
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
    expect(screen.queryByText(/sample targets/)).toBeNull(); // Stage 4's placeholders are gone
  });

  it('shows only what was eaten in Just-track mode', async () => {
    useGoalsStore.setState({
      targetRows: [
        targetsRow({ ...TARGETS, kcal: null, protein_g: null, carb_g: null, fat_g: null }),
      ],
    });
    await renderToday();

    expect(screen.getByRole('image', { name: '700 kcal eaten' })).toBeOnTheScreen();
    expect(screen.queryByText(/kcal left/)).toBeNull();
    expect(screen.getByLabelText('Protein: 31 g')).toBeOnTheScreen();
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

  it('shows shapes and words, and no calorie or gram numbers, with hide numbers on', async () => {
    useSettingsStore.setState({ hideNumbers: true });
    try {
      await renderToday();

      // 700 of 2,000 kcal = 35%: about halfway (SPEC §8.3).
      expect(
        screen.getByRole('image', { name: 'Calories today: About halfway' }),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText('Protein: About halfway')).toBeOnTheScreen(); // 31 of 60 g
      expect(screen.getByLabelText('Carbs: Just getting started')).toBeOnTheScreen(); // 60 of 250 g
      expect(screen.getByRole('button', { name: 'Protein from Paneer tikka' })).toBeOnTheScreen();
      // Meals still list what was eaten, and tapping still opens the entry.
      await fireEvent.press(screen.getByRole('button', { name: 'Poha' }));
      expect(screen.getByRole('header', { name: 'Edit quick add' })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

      expect(screen.queryAllByText(/kcal|\d g\b|\d%/)).toEqual([]);
    } finally {
      useSettingsStore.setState({ hideNumbers: false });
    }
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

describe('limit alerts on Today', () => {
  // Today's fat is 36 g; a 30 g limit is crossed by 6 g. Sodium isn't known for quick adds.
  beforeEach(() => {
    useGoalsStore.setState({ targetRows: [targetsRow({ ...TARGETS, fat_g_limit: 30 })] });
    useSettingsStore.setState({ alertNotifications: true });
    jest.mocked(notifyNow).mockClear();
  });
  afterAll(() => useSettingsStore.setState({ alertNotifications: false }));

  it('shows a calm note once a limit is crossed, and notifies once, not twice', async () => {
    await renderToday();
    expect(await screen.findByText("Fat is 6 g above today's limit.")).toBeOnTheScreen();
    expect(notifyNow).toHaveBeenCalledTimes(1);
    expect(notifyNow).toHaveBeenCalledWith('Today so far', "Fat is 6 g above today's limit.");

    // Opening Today again the same day: the note is still there, no second notification.
    await cleanup();
    await renderToday();
    expect(await screen.findByText("Fat is 6 g above today's limit.")).toBeOnTheScreen();
    expect(notifyNow).toHaveBeenCalledTimes(1);
  });

  it('shows the note on today only', async () => {
    useLogStore.setState({ day: '2026-09-25' });
    await renderToday();
    expect(screen.queryByTestId('alert-card')).toBeNull();
  });

  it('stays closed for the day once ✕ is tapped', async () => {
    await renderToday();
    await fireEvent.press(await screen.findByRole('button', { name: 'Close for today' }));
    expect(screen.queryByTestId('alert-card')).toBeNull();

    await cleanup();
    await renderToday();
    expect(screen.queryByTestId('alert-card')).toBeNull();
  });
});

describe('Today: water', () => {
  const waterText = (text: string) => screen.findByText(text);

  it('adds a glass with +, takes it off with −, and fills the goal after 8 glasses', async () => {
    useLogStore.setState({ day: '2026-09-26' }); // an empty day still shows water
    await renderToday();
    expect(await waterText('0 of 2,000 ml · 0 glasses')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Take off the last water' })).toBeDisabled();

    const plus = screen.getByRole('button', { name: 'Add a glass of water, 250 ml' });
    await fireEvent.press(plus);
    expect(await waterText('250 of 2,000 ml · 1 glass')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Take off the last water' }));
    expect(await waterText('0 of 2,000 ml · 0 glasses')).toBeOnTheScreen();

    for (let i = 0; i < 8; i++) {
      await fireEvent.press(plus);
      await act(async () => {});
    }
    expect(await waterText('2,000 of 2,000 ml · 8 glasses')).toBeOnTheScreen();
    expect(screen.getByText('Water goal reached for the day.')).toBeOnTheScreen();
  });

  it('adds a different amount with a long press on +', async () => {
    await renderToday();
    await fireEvent(
      screen.getByRole('button', { name: 'Add a glass of water, 250 ml' }),
      'longPress',
    );
    await fireEvent.changeText(screen.getByTestId('water-custom-ml'), '400');
    await fireEvent.press(screen.getByTestId('water-custom-add'));
    expect(await waterText('400 of 2,000 ml · 1.6 glasses')).toBeOnTheScreen();
  });

  it('uses the glass size and goal from Goals', async () => {
    useSettingsStore.setState({ waterGlassMl: 300, waterGoalMl: 2400 });
    useLogStore.setState({ day: '2026-09-25' });
    await renderToday();
    expect(await waterText('0 of 2,400 ml · 0 glasses')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add a glass of water, 300 ml' })).toBeOnTheScreen();
    useSettingsStore.setState({ waterGlassMl: 250, waterGoalMl: 2000 });
  });
});

describe('Today: streak and weekly check-in', () => {
  it('shows the streak small under the date, and explains it on tap', async () => {
    // Logged on the 25th and 27th; the 26th was a free day.
    await renderToday();
    const streak = screen.getByTestId('streak');
    expect(within(streak).getByText('2 day streak · 1 free day left this week')).toBeOnTheScreen();
    await fireEvent.press(streak);
    expect(screen.getByText(/Each week, Monday to Sunday, has 2 free days/)).toBeOnTheScreen();
  });

  it('shows no streak and no check-in on a past day', async () => {
    useLogStore.setState({ day: '2026-09-26' });
    await renderToday();
    expect(screen.queryByTestId('streak')).toBeNull();
    expect(screen.queryByTestId('weekly-checkin')).toBeNull();
  });

  it('shows no streak and no check-in when nothing was logged (a missed week gets no message)', async () => {
    // Monday the 14th: nothing logged yet, and last week (7th–13th) is empty.
    jest.spyOn(Date, 'now').mockReturnValue(at(14, 9));
    useLogStore.setState({ day: '2026-09-14' });
    await renderToday();
    expect(screen.queryByTestId('streak')).toBeNull();
    expect(screen.queryByTestId('weekly-checkin')).toBeNull();
  });

  describe('on Monday', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(at(28, 9));
      useLogStore.setState({ day: '2026-09-28' });
    });

    it('looks back at last week with one suggestion, and starts the week with 2 free days', async () => {
      await renderToday();
      expect(screen.getByText('2 day streak · 2 free days left this week')).toBeOnTheScreen();
      const card = screen.getByTestId('weekly-checkin');
      // The 20th (from the pull-to-refresh test) is the week before; the 25th and 27th are last week.
      expect(within(card).getByText('2 of 7 days logged')).toBeOnTheScreen();
      expect(within(card).getByText('Average 1,500 kcal a day · target 2,000')).toBeOnTheScreen();
      // Neither day was a full day, so the one closest to the target wins.
      expect(
        within(card).getByText('Best day: Fri, 25 Sep, closest to your target'),
      ).toBeOnTheScreen();
      // Only 2 days logged: too little for nutrient advice.
      expect(within(card).getByTestId('checkin-suggestion')).toHaveTextContent(
        /Logging on a few more days/,
      );
    });

    it('asks how the week felt and points to Goals after "Hard"', async () => {
      await renderToday();
      await fireEvent.press(screen.getByRole('radio', { name: 'Hard' }));
      expect(screen.getByText(/Want gentler targets/)).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('link'));
      expect(mockPush).toHaveBeenCalledWith('/goals');
    });

    it('stays closed once ✕ is tapped', async () => {
      await renderToday();
      await fireEvent.press(screen.getByRole('button', { name: "Close last week's check-in" }));
      expect(screen.queryByTestId('weekly-checkin')).toBeNull();
      cleanup();
      await renderToday();
      expect(screen.queryByTestId('weekly-checkin')).toBeNull();
    });
  });
});
