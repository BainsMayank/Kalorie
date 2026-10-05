import { shareBand } from './bands';

describe('shareBand (SPEC §8.3)', () => {
  it('puts each share in its band', () => {
    expect(shareBand(0)).toBe('start');
    expect(shareBand(0.2)).toBe('start');
    expect(shareBand(0.4)).toBe('half');
    expect(shareBand(0.75)).toBe('nearly');
    expect(shareBand(1)).toBe('around');
    expect(shareBand(1.5)).toBe('more');
  });

  it('starts each band at its lower edge', () => {
    expect(shareBand(0.249)).toBe('start');
    expect(shareBand(0.25)).toBe('half');
    expect(shareBand(0.6)).toBe('nearly');
    expect(shareBand(0.9)).toBe('around');
    expect(shareBand(1.1)).toBe('around');
    expect(shareBand(1.101)).toBe('more');
  });
});
