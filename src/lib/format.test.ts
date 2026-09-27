import { formatAmount, formatKcal, formatPercent, formatQty } from './format';

describe('formatKcal', () => {
  it('rounds to whole kcal with thousands separators', () => {
    expect(formatKcal(93.4)).toBe('93');
    expect(formatKcal(1840.2)).toBe('1,840');
    expect(formatKcal(12345.6)).toBe('12,346');
    expect(formatKcal(0)).toBe('0');
  });

  it('keeps unknown as unknown', () => {
    expect(formatKcal(null)).toBeNull();
  });
});

describe('formatAmount', () => {
  it('shows whole numbers from 10 up', () => {
    expect(formatAmount(12.4)).toBe('12');
    expect(formatAmount(9.96)).toBe('10');
    expect(formatAmount(2345.2)).toBe('2,345');
  });

  it('shows one decimal under 10, without a trailing .0', () => {
    expect(formatAmount(4.54)).toBe('4.5');
    expect(formatAmount(2.02)).toBe('2');
    expect(formatAmount(0.12)).toBe('0.1');
  });

  it('shows tiny amounts as <0.1 but zero as 0', () => {
    expect(formatAmount(0.03)).toBe('<0.1');
    expect(formatAmount(0)).toBe('0');
  });

  it('keeps unknown as unknown', () => {
    expect(formatAmount(null)).toBeNull();
  });
});

describe('formatQty', () => {
  it('drops trailing zeros', () => {
    expect(formatQty(1)).toBe('1');
    expect(formatQty(1.5)).toBe('1.5');
    expect(formatQty(0.25)).toBe('0.25');
    expect(formatQty(150)).toBe('150');
  });
});

describe('formatPercent', () => {
  it('rounds a share to a whole percent', () => {
    expect(formatPercent(0.384)).toBe('38');
    expect(formatPercent(1)).toBe('100');
    expect(formatPercent(0)).toBe('0');
  });

  it('shows "<1" for a tiny share that isn’t zero', () => {
    expect(formatPercent(0.004)).toBe('<1');
  });
});
