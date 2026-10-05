// Body measurements: height in feet + inches ↔ cm (stored as cm, SPEC §1), and age ↔ birth year.

export const CM_PER_INCH = 2.54;

/** Feet + inches → cm, one decimal. */
export function cmFromFtIn(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_INCH * 10) / 10;
}

/** cm → whole feet + inches (inches rounded; 12 inches carry over to the next foot). */
export function ftInFromCm(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

/** Age from birth year: this year − birth year (SPEC §5.4). */
export function ageFromBirthYear(birthYear: number, now: number = Date.now()): number {
  return new Date(now).getFullYear() - birthYear;
}

/** Birth year from an age typed in onboarding. */
export function birthYearFromAge(age: number, now: number = Date.now()): number {
  return new Date(now).getFullYear() - age;
}

/** Sensible ranges for typed numbers; anything outside is treated as a typo. */
export const BODY_RANGES = {
  age: { min: 1, max: 120 },
  heightCm: { min: 50, max: 250 },
  weightKg: { min: 20, max: 300 },
} as const;

/** The number if it falls inside the range, else `null`. */
export function inRange(value: number | null, range: { min: number; max: number }): number | null {
  return value !== null && value >= range.min && value <= range.max ? value : null;
}
