import type { SlotWindow } from './day';
import {
  REMINDERS_OFF,
  mealReminder,
  parseReminders,
  planReminders,
  remindersOn,
  serializeReminders,
  withOnboardingMeals,
  type ReminderSettings,
} from './reminders';

const hm = (h: number, m = 0) => h * 60 + m;
const SLOTS: SlotWindow[] = [
  { id: 'breakfast', position: 0, startMin: hm(4), endMin: hm(11), isHidden: false },
  { id: 'lunch', position: 1, startMin: hm(11), endMin: hm(16), isHidden: false },
  { id: 'snacks', position: 2, startMin: hm(16), endMin: hm(19), isHidden: false },
  { id: 'dinner', position: 3, startMin: hm(19), endMin: hm(4), isHidden: false },
];
// Monday 28 Sep 2026.
const at = (date: number, h: number, m = 0) => new Date(2026, 8, date, h, m).getTime();
const on = (minute: number) => ({ on: true, minute });
const MEALS: ReminderSettings = {
  meals: { breakfast: on(hm(9)), lunch: on(hm(13, 30)), dinner: on(hm(20, 30)) },
  pendingScans: { on: false, minute: hm(21) },
};
const plan = (
  overrides: Partial<Parameters<typeof planReminders>[0]> = {},
): ReturnType<typeof planReminders> =>
  planReminders({
    now: at(28, 12),
    settings: MEALS,
    slots: SLOTS,
    loggedSlots: new Map(),
    hasPendingScans: false,
    days: 2,
    ...overrides,
  });
const keys = (list: ReturnType<typeof planReminders>) => list.map((r) => r.key);

describe('planReminders', () => {
  it('plans nothing when every reminder is off (the default)', () => {
    expect(plan({ settings: REMINDERS_OFF, days: 7 })).toEqual([]);
  });

  it("plans each meal that's switched on, from now on, earliest first", () => {
    expect(keys(plan())).toEqual([
      'meal:lunch:2026-09-28',
      'meal:dinner:2026-09-28',
      'meal:breakfast:2026-09-29',
      'meal:lunch:2026-09-29',
      'meal:dinner:2026-09-29',
    ]);
    expect(plan()[0].at).toBe(at(28, 13, 30));
  });

  it('skips a meal that is already logged that day', () => {
    const loggedSlots = new Map([['2026-09-28', new Set(['lunch'])]]);
    expect(keys(plan({ loggedSlots, days: 1 }))).toEqual(['meal:dinner:2026-09-28']);
  });

  it('plans 7 days by default', () => {
    const all = planReminders({
      now: at(28, 12),
      settings: MEALS,
      slots: SLOTS,
      loggedSlots: new Map(),
      hasPendingScans: false,
    });
    expect(new Set(all.map((r) => r.day)).size).toBe(7);
    expect(all.at(-1)?.key).toBe('meal:dinner:2026-10-04');
  });

  it('leaves out hidden slots', () => {
    const slots = SLOTS.map((s) => (s.id === 'dinner' ? { ...s, isHidden: true } : s));
    expect(keys(plan({ slots, days: 1 }))).toEqual(['meal:lunch:2026-09-28']);
  });

  it('puts a reminder after midnight on the next calendar date of the same logical day', () => {
    const settings = { ...REMINDERS_OFF, meals: { dinner: on(hm(0, 30)) } };
    const [first] = plan({ settings, days: 1 });
    expect(first).toMatchObject({ day: '2026-09-28', at: at(29, 0, 30) });
  });

  it('never plans more than 3 a day, keeping the earliest', () => {
    const settings: ReminderSettings = {
      meals: { ...MEALS.meals, snacks: on(hm(17)) },
      pendingScans: MEALS.pendingScans,
    };
    const tomorrow = plan({ settings }).filter((r) => r.day === '2026-09-29');
    expect(keys(tomorrow)).toEqual([
      'meal:breakfast:2026-09-29',
      'meal:lunch:2026-09-29',
      'meal:snacks:2026-09-29',
    ]);
  });

  describe('pending scans nudge', () => {
    const settings = { ...REMINDERS_OFF, pendingScans: on(hm(21)) };

    it('is planned once, at its next time, only while scans are waiting', () => {
      expect(plan({ settings, hasPendingScans: true, days: 7 })).toEqual([
        {
          key: 'scans:2026-09-28',
          kind: 'pendingScans',
          slotId: null,
          day: '2026-09-28',
          at: at(28, 21),
        },
      ]);
      expect(plan({ settings, hasPendingScans: false, days: 7 })).toEqual([]);
    });

    it("moves to tomorrow once tonight's time has passed", () => {
      expect(keys(plan({ settings, hasPendingScans: true, now: at(28, 22) }))).toEqual([
        'scans:2026-09-29',
      ]);
    });
  });
});

describe('settings', () => {
  it('gives a slot with nothing saved its default time, switched off', () => {
    expect(mealReminder(REMINDERS_OFF, SLOTS[1])).toEqual({ on: false, minute: hm(13, 30) });
    // A custom slot: an hour after its window opens.
    expect(mealReminder(REMINDERS_OFF, { id: 'x', startMin: hm(22, 30) })).toEqual({
      on: false,
      minute: hm(23, 30),
    });
  });

  it('counts the reminders switched on', () => {
    expect(remindersOn(REMINDERS_OFF, SLOTS)).toBe(0);
    expect(remindersOn({ ...MEALS, pendingScans: on(hm(21)) }, SLOTS)).toBe(4);
  });

  it('onboarding turns on breakfast, lunch and dinner at their default times', () => {
    expect(withOnboardingMeals(REMINDERS_OFF).meals).toEqual(MEALS.meals);
  });

  it('saves as JSON with "HH:MM" times and reads back the same', () => {
    const json = serializeReminders(MEALS);
    expect(json.meals.lunch).toEqual({ on: true, at: '13:30' });
    expect(json.pendingScans).toEqual({ on: false, at: '21:00' });
    expect(parseReminders(JSON.parse(JSON.stringify(json)))).toEqual(MEALS);
  });

  it('reads anything broken as off', () => {
    expect(parseReminders(undefined)).toEqual(REMINDERS_OFF);
    expect(parseReminders('yes')).toEqual(REMINDERS_OFF);
    expect(parseReminders({ meals: { lunch: { on: true, at: '25:00' } } })).toEqual(REMINDERS_OFF);
  });
});
