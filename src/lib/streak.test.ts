import { forgivingStreak, weekStart } from './streak';

// September 2026: Mondays are the 7th, 14th, 21st and 28th.
const days = (...dates: number[]) =>
  new Set(dates.map((d) => `2026-09-${String(d).padStart(2, '0')}`));
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const without = (list: number[], ...skip: number[]) => list.filter((d) => !skip.includes(d));

describe('weekStart', () => {
  it('is the Monday of the week, Monday–Sunday', () => {
    expect(weekStart('2026-09-27')).toBe('2026-09-21'); // Sunday
    expect(weekStart('2026-09-28')).toBe('2026-09-28'); // Monday
    expect(weekStart('2026-09-23')).toBe('2026-09-21'); // Wednesday
  });

  it('crosses months and years', () => {
    expect(weekStart('2026-10-01')).toBe('2026-09-28');
    expect(weekStart('2027-01-01')).toBe('2026-12-28'); // a Friday
  });
});

describe('forgivingStreak', () => {
  it('is zero with nothing logged', () => {
    expect(forgivingStreak(new Set(), '2026-09-27')).toEqual({ days: 0, freeDaysLeft: 2 });
  });

  it('counts every logged day in an unbroken run, today included', () => {
    expect(forgivingStreak(days(...range(21, 27)), '2026-09-27')).toEqual({
      days: 7,
      freeDaysLeft: 2,
    });
  });

  it('never breaks because today has nothing logged yet', () => {
    const streak = forgivingStreak(days(...range(21, 26)), '2026-09-27');
    expect(streak).toEqual({ days: 6, freeDaysLeft: 2 });
  });

  it('keeps the streak through 2 missed days in one week', () => {
    // Week of the 21st: the 23rd and 25th missed.
    const logged = days(...without(range(14, 27), 23, 25));
    expect(forgivingStreak(logged, '2026-09-27')).toEqual({ days: 12, freeDaysLeft: 0 });
  });

  it('ends the streak on the 3rd missed day in one week', () => {
    // Week of the 21st: the 22nd, 23rd and 25th missed. Walking back from today, the 22nd is the
    // 3rd miss, so the run is the 24th, 26th and 27th, with the 25th as its one free day.
    const logged = days(...without(range(14, 27), 22, 23, 25));
    expect(forgivingStreak(logged, '2026-09-27')).toEqual({ days: 3, freeDaysLeft: 1 });
  });

  it('gives each week its own free days across a week boundary', () => {
    // Sat 19 + Sun 20 missed (week of the 14th), Mon 21 + Tue 22 missed (week of the 21st):
    // four misses in a row, but only two in each week, so the streak goes on.
    const logged = days(...range(14, 18), 23);
    expect(forgivingStreak(logged, '2026-09-23')).toEqual({ days: 6, freeDaysLeft: 0 });
  });

  it('ends the streak with 3 misses at the end of one week, even if the next week is full', () => {
    // Fri 18, Sat 19, Sun 20 missed: the 3rd miss in the week of the 14th.
    const logged = days(...range(14, 17), ...range(21, 27));
    expect(forgivingStreak(logged, '2026-09-27')).toEqual({ days: 7, freeDaysLeft: 2 });
  });

  it('starts every Monday with 2 free days', () => {
    // Last week had two misses; today is Monday the 28th, nothing logged yet.
    const logged = days(...without(range(21, 27), 22, 24));
    expect(forgivingStreak(logged, '2026-09-28')).toEqual({ days: 5, freeDaysLeft: 2 });
  });

  it('counts a miss this week only once a logged day comes before it', () => {
    // Mon 21 logged, Tue 22 missed, today (Wed 23) not logged yet: one free day used.
    expect(forgivingStreak(days(21), '2026-09-23')).toEqual({ days: 1, freeDaysLeft: 1 });
  });

  it("doesn't let the misses that ended an old streak use up this week's free days", () => {
    // Mon 21, Tue 22, Wed 23 missed (the old streak ended), Thu 24 logged, today is Fri 25.
    const logged = days(...range(14, 20), 24);
    expect(forgivingStreak(logged, '2026-09-25')).toEqual({ days: 1, freeDaysLeft: 2 });
  });

  it('is zero after a 3rd miss with nothing logged since (a fresh start)', () => {
    // Last logged Sun 20; Mon 21, Tue 22, Wed 23 missed; today Thu 24 not logged yet.
    expect(forgivingStreak(days(...range(14, 20)), '2026-09-24')).toEqual({
      days: 0,
      freeDaysLeft: 2,
    });
  });

  it("doesn't count days before the first day anything was logged as misses", () => {
    // First entry on Thu 17; Mon 14 – Wed 16 were before the app was used.
    expect(forgivingStreak(days(...range(17, 20)), '2026-09-20')).toEqual({
      days: 4,
      freeDaysLeft: 2,
    });
  });

  it('ignores days after today', () => {
    expect(forgivingStreak(days(26, 27, 28, 29), '2026-09-27')).toEqual({
      days: 2,
      freeDaysLeft: 2,
    });
  });

  it('works across a month boundary', () => {
    const logged = new Set(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(forgivingStreak(logged, '2026-10-02')).toEqual({ days: 4, freeDaysLeft: 2 });
  });
});
