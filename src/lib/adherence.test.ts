import { adherence, adherenceByDay, countAdherence } from './adherence';

describe('adherence colour rules (SPEC §5.6)', () => {
  const day = (entryCount: number, kcal: number, targetKcal: number | null = 2000) =>
    adherence({ entryCount, kcal, targetKcal });

  it('is empty with nothing logged, and partial with fewer than 3 entries', () => {
    expect(day(0, 0)).toBe('empty');
    expect(day(1, 2000)).toBe('partial');
    expect(day(2, 2000)).toBe('partial');
    expect(day(3, 2000)).toBe('onTarget');
  });

  it('is on target within ±10%, both edges included', () => {
    expect(day(4, 1800)).toBe('onTarget');
    expect(day(4, 2200)).toBe('onTarget');
    expect(day(4, 2000)).toBe('onTarget');
  });

  it('is "a bit under or over" from 10% to 25% away, both ways', () => {
    expect(day(4, 1799)).toBe('near');
    expect(day(4, 2201)).toBe('near');
    expect(day(4, 1500)).toBe('near');
    expect(day(4, 2500)).toBe('near');
  });

  it('is far off beyond 25%, under or over', () => {
    expect(day(4, 1499)).toBe('far');
    expect(day(4, 2501)).toBe('far');
    expect(day(5, 4000)).toBe('far');
  });

  it('is just "logged" without a calorie target (Just track)', () => {
    expect(day(3, 900, null)).toBe('logged');
    expect(day(3, 900, 0)).toBe('logged');
    expect(day(2, 900, null)).toBe('partial');
  });

  it('treats today as still going: under target is partial, on or above is judged', () => {
    const today = (kcal: number) =>
      adherence({ entryCount: 3, kcal, targetKcal: 2000, inProgress: true });
    expect(today(600)).toBe('partial');
    expect(today(1799)).toBe('partial');
    expect(today(1800)).toBe('onTarget');
    expect(today(2400)).toBe('near');
    expect(today(3000)).toBe('far');
  });

  it('never returns a colour meaning "bad" — there is no such value', () => {
    const all = new Set(
      [0, 1, 3].flatMap((n) => [0, 1000, 1900, 2300, 5000].map((kcal) => day(n, kcal))),
    );
    expect([...all].sort()).toEqual(['empty', 'far', 'near', 'onTarget', 'partial']);
  });
});

describe('adherenceByDay (a month with gaps)', () => {
  const logged = new Map([
    ['2026-09-01', { entryCount: 4, kcal: 2000 }],
    ['2026-09-02', { entryCount: 3, kcal: 2400 }],
    // 3rd–9th: nothing logged
    ['2026-09-10', { entryCount: 1, kcal: 300 }],
    ['2026-09-15', { entryCount: 5, kcal: 1200 }],
    ['2026-09-20', { entryCount: 3, kcal: 1500 }], // today, still going
  ]);

  it('colours every day up to today, leaving the gaps empty', () => {
    const colours = adherenceByDay('2026-09-01', '2026-09-30', logged, () => 2000, '2026-09-20');
    expect(colours.size).toBe(20); // 21st–30th are after today
    expect(colours.get('2026-09-01')).toBe('onTarget');
    expect(colours.get('2026-09-02')).toBe('near');
    for (let d = 3; d <= 9; d++) expect(colours.get(`2026-09-0${d}`)).toBe('empty');
    expect(colours.get('2026-09-10')).toBe('partial');
    expect(colours.get('2026-09-15')).toBe('far');
    expect(colours.get('2026-09-20')).toBe('partial');
    expect(colours.has('2026-09-21')).toBe(false);

    expect(countAdherence(colours.values())).toEqual({
      empty: 15,
      partial: 2,
      logged: 0,
      onTarget: 1,
      near: 1,
      far: 1,
    });
  });

  it('uses the target in effect on each day', () => {
    const targetFor = (day: string) => (day < '2026-09-15' ? 2000 : 1300);
    const colours = adherenceByDay('2026-09-14', '2026-09-15', logged, targetFor, '2026-09-30');
    expect(colours.get('2026-09-15')).toBe('onTarget'); // 1200 is within 10% of 1300
  });

  it('works across a month boundary and in a leap year', () => {
    const colours = adherenceByDay('2028-02-27', '2028-03-01', new Map(), () => 2000, '2028-12-31');
    expect([...colours.keys()]).toEqual(['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01']);
  });
});
