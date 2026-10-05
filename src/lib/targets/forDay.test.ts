import { rowForDay } from './forDay';

const rows = [
  { effectiveFrom: '2026-09-27', kcal: 2000 },
  { effectiveFrom: '2026-10-05', kcal: 1800 },
];

describe('rowForDay', () => {
  it('uses the latest row that had started by that day', () => {
    expect(rowForDay(rows, '2026-10-01')?.kcal).toBe(2000);
    expect(rowForDay(rows, '2026-10-05')?.kcal).toBe(1800);
    expect(rowForDay(rows, '2026-12-01')?.kcal).toBe(1800);
  });

  it('uses the first row for days before any targets were set', () => {
    expect(rowForDay(rows, '2026-09-20')?.kcal).toBe(2000);
    expect(rowForDay([], '2026-09-20')).toBeNull();
  });
});
