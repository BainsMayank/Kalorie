import { daysBetween, trendDirection, weeklyChange, weightTrend } from './trend';

describe('weightTrend: exponential moving average, 10% (SPEC §5.7)', () => {
  it('starts at the first weigh-in and moves 10% towards each new one', () => {
    const points = weightTrend([
      { day: '2026-09-01', kg: 70 },
      { day: '2026-09-02', kg: 71 },
      { day: '2026-09-03', kg: 69 },
    ]);
    expect(points.map((p) => p.trendKg)).toEqual([70, 70.1, expect.closeTo(69.99, 10)]);
    expect(points.map((p) => p.kg)).toEqual([70, 71, 69]);
  });

  it('sorts weigh-ins by day first', () => {
    const points = weightTrend([
      { day: '2026-09-05', kg: 80 },
      { day: '2026-09-01', kg: 70 },
    ]);
    expect(points.map((p) => p.day)).toEqual(['2026-09-01', '2026-09-05']);
    expect(points[1].trendKg).toBe(71);
  });

  it('takes one step per weigh-in, however far apart they are', () => {
    const points = weightTrend([
      { day: '2026-01-01', kg: 60 },
      { day: '2026-09-01', kg: 70 },
    ]);
    expect(points[1].trendKg).toBe(61);
  });

  it('stays smooth when weights bounce up and down (PLAN Stage 8 "done when")', () => {
    const bouncy = [72, 74, 71.5, 74.5, 71].map((kg, i) => ({ day: `2026-09-0${i + 1}`, kg }));
    const trend = weightTrend(bouncy).map((p) => p.trendKg);
    const rawSwing = 74.5 - 71;
    const trendSwing = Math.max(...trend) - Math.min(...trend);
    expect(trendSwing).toBeLessThan(rawSwing / 5);
    // Each step moves at most a tenth of the jump.
    for (let i = 1; i < trend.length; i++) {
      expect(Math.abs(trend[i] - trend[i - 1])).toBeLessThanOrEqual(
        Math.abs(bouncy[i].kg - trend[i - 1]) * 0.1 + 1e-9,
      );
    }
  });

  it('is empty without weigh-ins', () => {
    expect(weightTrend([])).toEqual([]);
  });
});

describe('weeklyChange', () => {
  it('is the trend’s change per week since the latest weigh-in a week or more before', () => {
    const points = [
      { day: '2026-09-01', kg: 70, trendKg: 70 },
      { day: '2026-09-08', kg: 69, trendKg: 69.8 },
      { day: '2026-09-10', kg: 69, trendKg: 69.6 },
      { day: '2026-09-15', kg: 69, trendKg: 69.5 },
    ];
    // 15th back to the 8th (7 days): −0.3 kg.
    expect(weeklyChange(points)).toBeCloseTo(-0.3, 10);
  });

  it('scales a longer stretch to a week', () => {
    const points = [
      { day: '2026-09-01', kg: 70, trendKg: 70 },
      { day: '2026-09-15', kg: 71, trendKg: 71 },
    ];
    expect(weeklyChange(points)).toBeCloseTo(0.5, 10);
  });

  it('waits until the weigh-ins span a week', () => {
    expect(weeklyChange([])).toBeNull();
    expect(
      weeklyChange([
        { day: '2026-09-01', kg: 70, trendKg: 70 },
        { day: '2026-09-07', kg: 69, trendKg: 69.9 },
      ]),
    ).toBeNull();
  });
});

describe('helpers', () => {
  it('counts days between two days, across months and clock changes', () => {
    expect(daysBetween('2026-09-01', '2026-09-08')).toBe(7);
    expect(daysBetween('2026-10-20', '2026-11-05')).toBe(16);
    expect(daysBetween('2026-03-01', '2026-02-27')).toBe(-2);
  });

  it('calls tiny changes steady', () => {
    expect(trendDirection(-0.3)).toBe('down');
    expect(trendDirection(0.2)).toBe('up');
    expect(trendDirection(0.04)).toBe('steady');
    expect(trendDirection(-0.04)).toBe('steady');
  });
});
