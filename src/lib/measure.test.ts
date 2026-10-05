import { ageFromBirthYear, birthYearFromAge, cmFromFtIn, ftInFromCm, inRange } from './measure';

describe('height', () => {
  it('converts feet + inches to cm and back', () => {
    expect(cmFromFtIn(5, 7)).toBe(170.2);
    expect(ftInFromCm(170.2)).toEqual({ feet: 5, inches: 7 });
    expect(ftInFromCm(182.5)).toEqual({ feet: 6, inches: 0 }); // 71.85 in → 72 → 6 ft 0 in
  });
});

describe('age', () => {
  const now = new Date(2026, 8, 27).getTime();
  it('goes between age and birth year', () => {
    expect(birthYearFromAge(30, now)).toBe(1996);
    expect(ageFromBirthYear(1996, now)).toBe(30);
  });
});

describe('inRange', () => {
  it('drops typos outside the range', () => {
    expect(inRange(70, { min: 20, max: 300 })).toBe(70);
    expect(inRange(700, { min: 20, max: 300 })).toBeNull();
    expect(inRange(null, { min: 20, max: 300 })).toBeNull();
  });
});
