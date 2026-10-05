import {
  LOGICAL_DAY_HOURS,
  addDays,
  autoSlot,
  clockMinute,
  defaultEntryMinute,
  isInWindow,
  logicalDay,
  relativeDay,
  timeOnDay,
  timeParts,
  weekday,
  withHour,
  withMinutes,
  type SlotWindow,
} from './day';

// Times are built with the local clock (new Date(y, m, d, h, min)), so the tests pass in any
// time zone. Months in `new Date` start at 0: 8 = September.
const at = (h: number, min = 0, date = 27) => new Date(2026, 8, date, h, min).getTime();
const hm = (h: number, min = 0) => h * 60 + min;

/** The default slots from SPEC §4.2. */
const SLOTS: SlotWindow[] = [
  { id: 'breakfast', position: 0, startMin: hm(4), endMin: hm(11), isHidden: false },
  { id: 'lunch', position: 1, startMin: hm(11), endMin: hm(16), isHidden: false },
  { id: 'snacks', position: 2, startMin: hm(16), endMin: hm(19), isHidden: false },
  { id: 'dinner', position: 3, startMin: hm(19), endMin: hm(4), isHidden: false },
];

describe('logicalDay', () => {
  it('starts a new day at 4:00 am', () => {
    expect(logicalDay(at(4, 0))).toBe('2026-09-27');
    expect(logicalDay(at(3, 59))).toBe('2026-09-26'); // 3:59 am → the day before
  });

  it('keeps a midnight snack on the evening before', () => {
    expect(logicalDay(at(0, 0))).toBe('2026-09-26');
    expect(logicalDay(at(23, 59))).toBe('2026-09-27');
  });

  it('works across months and years', () => {
    expect(logicalDay(new Date(2026, 9, 1, 2, 0).getTime())).toBe('2026-09-30');
    expect(logicalDay(new Date(2027, 0, 1, 1, 0).getTime())).toBe('2026-12-31');
  });
});

describe('addDays', () => {
  it('moves forward and back across month and year ends', () => {
    expect(addDays('2026-09-27', -1)).toBe('2026-09-26');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29'); // leap year
  });
});

describe('weekday', () => {
  it('gives 0 for Sunday', () => {
    expect(weekday('2026-09-27')).toBe(0);
    expect(weekday('2026-09-28')).toBe(1);
  });
});

describe('timeOnDay', () => {
  it('puts daytime on the same calendar date', () => {
    expect(timeOnDay('2026-09-27', hm(13, 30))).toBe(at(13, 30));
  });

  it('puts times before 4 am on the next calendar date', () => {
    expect(timeOnDay('2026-09-27', hm(1, 0))).toBe(at(1, 0, 28));
    expect(logicalDay(timeOnDay('2026-09-27', hm(3, 59)))).toBe('2026-09-27');
  });

  it('round-trips with clockMinute', () => {
    expect(clockMinute(timeOnDay('2026-09-27', hm(20, 15)))).toBe(hm(20, 15));
  });
});

describe('time helpers', () => {
  it('orders the hours of a logical day from 4 am to 3 am', () => {
    expect(LOGICAL_DAY_HOURS[0]).toBe(4);
    expect(LOGICAL_DAY_HOURS.slice(-4)).toEqual([0, 1, 2, 3]);
  });

  it('changes the hour or the minutes of a time', () => {
    expect(withHour(hm(13, 30), 20)).toBe(hm(20, 30));
    expect(withMinutes(hm(13, 5), 45)).toBe(hm(13, 45));
  });

  it('splits a time into 12-hour parts', () => {
    expect(timeParts(hm(0, 5))).toEqual({ hour: 12, minutes: '05', period: 'am' });
    expect(timeParts(hm(12, 0))).toEqual({ hour: 12, minutes: '00', period: 'pm' });
    expect(timeParts(hm(13, 30))).toEqual({ hour: 1, minutes: '30', period: 'pm' });
  });
});

describe('relativeDay', () => {
  it('names today, yesterday and tomorrow only', () => {
    expect(relativeDay('2026-09-27', '2026-09-27')).toBe('today');
    expect(relativeDay('2026-09-26', '2026-09-27')).toBe('yesterday');
    expect(relativeDay('2026-09-28', '2026-09-27')).toBe('tomorrow');
    expect(relativeDay('2026-09-20', '2026-09-27')).toBeNull();
  });
});

describe('isInWindow', () => {
  it('includes the start and excludes the end', () => {
    expect(isInWindow(hm(11), SLOTS[1])).toBe(true);
    expect(isInWindow(hm(16), SLOTS[1])).toBe(false);
  });

  it('handles windows that wrap past midnight', () => {
    expect(isInWindow(hm(23), SLOTS[3])).toBe(true);
    expect(isInWindow(hm(2), SLOTS[3])).toBe(true);
    expect(isInWindow(hm(4), SLOTS[3])).toBe(false);
  });
});

describe('autoSlot (slot default by time)', () => {
  const slotAt = (h: number, min = 0, slots = SLOTS) => autoSlot(slots, hm(h, min))?.id;

  it('picks the slot whose window holds the time', () => {
    expect(slotAt(8)).toBe('breakfast');
    expect(slotAt(13, 30)).toBe('lunch');
    expect(slotAt(17)).toBe('snacks');
    expect(slotAt(20, 30)).toBe('dinner');
  });

  it('switches exactly at the window edges', () => {
    expect(slotAt(4, 0)).toBe('breakfast');
    expect(slotAt(10, 59)).toBe('breakfast');
    expect(slotAt(11, 0)).toBe('lunch');
    expect(slotAt(15, 59)).toBe('lunch');
    expect(slotAt(16, 0)).toBe('snacks');
    expect(slotAt(19, 0)).toBe('dinner');
  });

  it('keeps late-night eating in Dinner (midnight wrap)', () => {
    expect(slotAt(0, 0)).toBe('dinner');
    expect(slotAt(3, 59)).toBe('dinner');
  });

  it('skips hidden slots and falls back to the last visible slot', () => {
    const noSnacks = SLOTS.map((s) => (s.id === 'snacks' ? { ...s, isHidden: true } : s));
    // 17:00 is in no visible window, so it goes to the last visible slot.
    expect(slotAt(17, 0, noSnacks)).toBe('dinner');
    expect(slotAt(12, 0, noSnacks)).toBe('lunch');
  });

  it('uses the order on screen, not the order in the list', () => {
    const custom: SlotWindow = {
      id: 'pre-workout',
      position: 1,
      startMin: hm(6),
      endMin: hm(7),
      isHidden: false,
    };
    const slots = [...SLOTS.map((s) => ({ ...s, position: s.position * 2 })), custom];
    // Breakfast (position 0) covers 6:00 too and comes first.
    expect(slotAt(6, 30, slots)).toBe('breakfast');
    expect(slotAt(6, 30, [{ ...custom, position: -1 }, ...SLOTS])).toBe('pre-workout');
  });

  it('gives nothing when every slot is hidden', () => {
    expect(
      slotAt(
        12,
        0,
        SLOTS.map((s) => ({ ...s, isHidden: true })),
      ),
    ).toBeUndefined();
  });
});

describe('defaultEntryMinute', () => {
  it('uses the time now', () => {
    expect(defaultEntryMinute(at(13, 20))).toBe(hm(13, 20));
    expect(defaultEntryMinute(at(13, 20), SLOTS[1])).toBe(hm(13, 20)); // now is lunch time
  });

  it('uses the slot’s start when now is outside the chosen slot', () => {
    expect(defaultEntryMinute(at(13, 20), SLOTS[3])).toBe(hm(19)); // + Add on Dinner at 1:20 pm
  });
});
