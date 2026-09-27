import { parseAmount } from './parse';

describe('parseAmount', () => {
  it('reads whole and decimal numbers, with a dot or a comma', () => {
    expect(parseAmount('250')).toBe(250);
    expect(parseAmount(' 12.5 ')).toBe(12.5);
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('0')).toBe(0);
  });

  it('gives null for empty, negative or non-numbers', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});
