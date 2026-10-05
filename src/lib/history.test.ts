import { barChartMax, lineChartRange, niceCeil } from './chart';
import {
  averageWater,
  monthRange,
  periodDays,
  periodStats,
  totalsByDay,
  waterByDay,
  type DayTrendTargets,
} from './history';
import { emptyNutrients, type NutrientValues } from './nutrients';
import { glasses, goalGlasses, parseMl } from './water';

function n(kcal: number | null, p: number | null = null, c = 0, f = 0): NutrientValues {
  return { ...emptyNutrients(), energy_kcal: kcal, protein_g: p, carb_g: c, fat_g: f };
}

describe('totalsByDay', () => {
  it('adds up each day’s entries; unknown counts as none', () => {
    const totals = totalsByDay([
      { day: '2026-09-01', nutrients: n(300, 10, 40, 5) },
      { day: '2026-09-01', nutrients: n(null, null) },
      { day: '2026-09-03', nutrients: n(500, 20, 60, 10) },
    ]);
    expect(totals.get('2026-09-01')).toEqual({
      entryCount: 2,
      kcal: 300,
      protein_g: 10,
      carb_g: 40,
      fat_g: 5,
    });
    expect(totals.has('2026-09-02')).toBe(false);
    expect(totals.get('2026-09-03')?.kcal).toBe(500);
  });
});

describe('periods', () => {
  it('lists the days of a week or month ending on a day', () => {
    expect(periodDays('2026-09-03', 7)).toEqual([
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
    expect(periodDays('2026-09-30', 30)).toHaveLength(30);
  });

  it('gives a month’s first and last day', () => {
    expect(monthRange('2026-09-17')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthRange('2028-02-03')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('periodStats', () => {
  const targets: DayTrendTargets = { kcal: 2000, protein_g: 60, carb_g: 250, fat_g: 65 };
  const day = (kcal: number, entryCount = 3, protein_g = 50) => ({
    entryCount,
    kcal,
    protein_g,
    carb_g: 200,
    fat_g: 60,
  });

  it('averages over logged days only — missed days are not zero-calorie days', () => {
    const days = periodDays('2026-09-07', 7);
    const totals = new Map([
      ['2026-09-01', day(2000)],
      ['2026-09-03', day(1600, 1)], // partly logged still counts
      ['2026-09-05', day(2400)],
    ]);
    const stats = periodStats(days, totals, () => targets, '2026-09-30');
    expect(stats.countedDays).toBe(3);
    expect(stats.counted).toEqual(['2026-09-01', '2026-09-03', '2026-09-05']);
    expect(stats.average.kcal).toBe(2000);
    expect(stats.average.protein_g).toBe(50);
    expect(stats.onTargetDays).toBe(1);
    expect(stats.averageTarget.kcal).toBe(2000);
    expect(stats.adherence.get('2026-09-02')).toBe('empty');
    expect(stats.adherence.get('2026-09-03')).toBe('partial');
  });

  it('leaves today out while it is still going, and counts it once it looks finished', () => {
    const days = periodDays('2026-09-07', 7);
    const early = new Map([
      ['2026-09-06', day(2000)],
      ['2026-09-07', day(500)],
    ]);
    expect(periodStats(days, early, () => targets, '2026-09-07').average.kcal).toBe(2000);
    const done = new Map([
      ['2026-09-06', day(2000)],
      ['2026-09-07', day(1900)],
    ]);
    const stats = periodStats(days, done, () => targets, '2026-09-07');
    expect(stats.countedDays).toBe(2);
    expect(stats.average.kcal).toBe(1950);
  });

  it('has no averages before anything is logged, and none without targets', () => {
    const stats = periodStats(periodDays('2026-09-07', 7), new Map(), () => null, '2026-09-07');
    expect(stats.countedDays).toBe(0);
    expect(stats.average.kcal).toBeNull();
    expect(stats.averageTarget.kcal).toBeNull();
  });

  it('averages the targets in effect on the counted days', () => {
    const days = ['2026-09-01', '2026-09-02'];
    const totals = new Map([
      ['2026-09-01', day(2000)],
      ['2026-09-02', day(1800)],
    ]);
    const targetsFor = (d: string) => ({ ...targets, kcal: d === '2026-09-01' ? 2000 : 1800 });
    const stats = periodStats(days, totals, targetsFor, '2026-09-30');
    expect(stats.averageTarget.kcal).toBe(1900);
    expect(stats.onTargetDays).toBe(2);
  });

  it('skips days after today', () => {
    const stats = periodStats(['2026-09-08'], new Map(), () => targets, '2026-09-07');
    expect(stats.adherence.size).toBe(0);
  });
});

describe('water', () => {
  it('adds up each day and averages days with water logged', () => {
    const ml = waterByDay([
      { day: '2026-09-01', ml: 250 },
      { day: '2026-09-01', ml: 500 },
      { day: '2026-09-03', ml: 1250 },
    ]);
    expect(ml.get('2026-09-01')).toBe(750);
    expect(averageWater(['2026-09-01', '2026-09-02', '2026-09-03'], ml)).toBe(1000);
    expect(averageWater(['2026-09-02'], ml)).toBeNull();
  });

  it('counts glasses and the icons to show', () => {
    expect(glasses(750, 250)).toBe(3);
    expect(glasses(600, 250)).toBe(2.4);
    expect(goalGlasses(2000, 250)).toBe(8);
    expect(goalGlasses(2100, 250)).toBe(9);
    expect(goalGlasses(10000, 100)).toBe(12);
    expect(goalGlasses(100, 250)).toBe(1);
  });

  it('reads ml settings, falling back when missing or silly', () => {
    const range = { min: 50, max: 1000 };
    expect(parseMl(300, range, 250)).toBe(300);
    expect(parseMl('330.4', range, 250)).toBe(330);
    expect(parseMl(undefined, range, 250)).toBe(250);
    expect(parseMl('abc', range, 250)).toBe(250);
    expect(parseMl(5000, range, 250)).toBe(250);
  });
});

describe('chart scales', () => {
  it('rounds up to a nice number', () => {
    expect(niceCeil(1840)).toBe(2000);
    expect(niceCeil(2001)).toBe(2500);
    expect(niceCeil(2600)).toBe(5000);
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(100)).toBe(100);
  });

  it('puts a bar chart’s top a little above the tallest bar or target', () => {
    expect(barChartMax([1800, null, 2100])).toBe(2500);
    expect(barChartMax([])).toBe(1);
  });

  it('gives weight a range at least 2 kg tall, rounded out', () => {
    expect(lineChartRange([70.2, 70.4])).toEqual({ min: 69, max: 72 });
    const wide = lineChartRange([60, 70]);
    expect(wide.min).toBeLessThanOrEqual(59);
    expect(wide.max).toBeGreaterThanOrEqual(71);
    expect(lineChartRange([])).toEqual({ min: 0, max: 2 });
  });
});
