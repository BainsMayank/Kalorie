import {
  bmr,
  checkFloor,
  defaultLimits,
  macroTargets,
  paceDelta,
  roundKcal,
  suggestTargets,
  targetsForKcal,
  tdee,
  type BodyProfile,
} from './formulas';

const person = (p: Partial<BodyProfile>): BodyProfile => ({
  sex: null,
  age: null,
  heightCm: null,
  weightKg: null,
  activity: null,
  goal: null,
  paceKgWeek: null,
  ...p,
});

describe('building blocks', () => {
  it('works out BMR with Mifflin-St Jeor', () => {
    expect(bmr('m', 70, 175, 30)).toBe(1648.75); // 700 + 1093.75 − 150 + 5
    expect(bmr('f', 60, 160, 28)).toBe(1299); // 600 + 1000 − 140 − 161
    expect(bmr('x', 80, 170, 45)).toBe(1559.5); // 800 + 1062.5 − 225 − 78
  });

  it('multiplies by the activity factor', () => {
    expect(tdee(1000, 'sedentary')).toBe(1200);
    expect(tdee(1000, 'very_active')).toBe(1900);
  });

  it('turns a pace into daily calories', () => {
    expect(paceDelta(0.25)).toBe(275);
    expect(paceDelta(0.5)).toBe(550);
  });

  it('rounds calories to the nearest 50', () => {
    expect(roundKcal(2555.56)).toBe(2550);
    expect(roundKcal(1236.1)).toBe(1250);
    expect(roundKcal(1225)).toBe(1250);
  });

  it('gives carbs what protein and fat leave', () => {
    // 15% protein beats 0.83 g/kg here.
    expect(macroTargets(2000, 60)).toEqual({ protein_g: 75, carb_g: 275, fat_g: 67 });
    // 100 kg × 0.83 = 83 g protein beats 15% of 1600 kcal (60 g); carbs shrink to make room.
    expect(macroTargets(1600, 100)).toEqual({ protein_g: 83, carb_g: 197, fat_g: 53 });
  });

  it('sets limits from the calorie target, or 2000 kcal without one', () => {
    expect(defaultLimits(2000)).toEqual({ sodium_mg: 2000, sugar_g: 50, sat_fat_g: 22, fat_g: 67 });
    expect(defaultLimits(null)).toEqual(defaultLimits(2000));
  });
});

// Worked by hand, step by step, so a friend can check them with a calculator.
describe('starting targets for 4 sample people', () => {
  it('man, 30, 175 cm, 70 kg, moderate exercise, maintain', () => {
    // BMR 1648.75 × 1.55 = 2555.6 → 2550 kcal
    const s = suggestTargets(
      person({
        sex: 'm',
        age: 30,
        heightCm: 175,
        weightKg: 70,
        activity: 'moderate',
        goal: 'maintain',
      }),
    );
    expect(s.targets).toEqual({
      kcal: 2550,
      protein_g: 96, // 2550 × 15% ÷ 4 = 95.6 (more than 0.83 × 70 = 58)
      carb_g: 351, // (2550 − 4 × 95.6 − 9 × 85) ÷ 4
      fat_g: 85, // 2550 × 30% ÷ 9
      fibre_g: 40, // ICMR man, moderate work (p. 13)
      sodium_mg_limit: 2000,
      sugar_g_limit: 64, // 2550 × 10% ÷ 4
      sat_fat_g_limit: 28, // 2550 × 10% ÷ 9
      fat_g_limit: 85,
    });
    expect(checkFloor(2550, { sex: 'm', age: 30, heightCm: 175, weightKg: 70 })?.below).toBe(false);
  });

  it('woman, 28, 160 cm, 60 kg, light activity, lose 0.5 kg a week — just under her BMR', () => {
    // BMR 1299 × 1.375 = 1786.1 − 550 = 1236.1 → 1250 kcal, which is under her BMR (1299)
    const profile = person({
      sex: 'f',
      age: 28,
      heightCm: 160,
      weightKg: 60,
      activity: 'light',
      goal: 'lose',
      paceKgWeek: 0.5,
    });
    const s = suggestTargets(profile);
    expect(s.targets).toMatchObject({
      kcal: 1250,
      protein_g: 50, // 0.83 × 60 = 49.8 beats 1250 × 15% ÷ 4 = 46.9
      carb_g: 169, // (1250 − 4 × 49.8 − 9 × 41.7) ÷ 4
      fat_g: 42,
      fibre_g: 25, // ICMR woman, sedentary (light maps to sedentary)
      sugar_g_limit: 31,
    });
    expect(checkFloor(s.targets.kcal, profile)).toEqual({
      floor: 1299,
      suggestion: 1300,
      below: true,
    });
  });

  it('prefer not to say, 45, 170 cm, 80 kg, mostly sitting, gain 0.25 kg a week', () => {
    // BMR 1559.5 × 1.2 = 1871.4 + 275 = 2146.4 → 2150 kcal
    const profile = person({
      sex: 'x',
      age: 45,
      heightCm: 170,
      weightKg: 80,
      activity: 'sedentary',
      goal: 'gain',
      paceKgWeek: 0.25,
    });
    const s = suggestTargets(profile);
    expect(s.targets).toMatchObject({
      kcal: 2150,
      protein_g: 81,
      carb_g: 296,
      fat_g: 72,
      fibre_g: 30, // the higher of man (30) and woman (25)
    });
    expect(checkFloor(2150, profile)?.below).toBe(false);
  });

  it('woman, 65, 150 cm, 45 kg, mostly sitting, lose 0.5 kg a week — far under the floor', () => {
    // BMR 901.5 × 1.2 = 1081.8 − 550 = 531.8 → 550 kcal; floor = max(1200, BMR) = 1200
    const profile = person({
      sex: 'f',
      age: 65,
      heightCm: 150,
      weightKg: 45,
      activity: 'sedentary',
      goal: 'lose',
      paceKgWeek: 0.5,
    });
    const s = suggestTargets(profile);
    expect(s.targets.kcal).toBe(550);
    expect(s.targets.fibre_g).toBe(25); // ICMR women ≥ 60 (p. 15)
    expect(checkFloor(550, profile)).toEqual({ floor: 1200, suggestion: 1200, below: true });
  });
});

describe('when there is no calorie target', () => {
  it('Just track keeps limits (on 2000 kcal) and fibre but no calories or macros', () => {
    const s = suggestTargets(
      person({ sex: 'f', age: 30, heightCm: 160, weightKg: 55, goal: 'track' }),
    );
    expect(s.noKcalReason).toBe('track');
    expect(s.targets).toMatchObject({
      kcal: null,
      protein_g: null,
      fibre_g: 25,
      sugar_g_limit: 50,
    });
  });

  it('under 18 gets no targets and no fibre', () => {
    const s = suggestTargets(
      person({ sex: 'm', age: 16, heightCm: 170, weightKg: 55, goal: 'lose' }),
    );
    expect(s.noKcalReason).toBe('under18');
    expect(s.targets.kcal).toBeNull();
    expect(s.targets.fibre_g).toBeNull();
  });

  it('says which body numbers are missing when some were skipped', () => {
    const s = suggestTargets(person({ sex: 'm', weightKg: 70, goal: 'maintain' }));
    expect(s.noKcalReason).toBe('missing');
    expect(s.missing).toEqual(['age', 'height']);
    expect(s.targets.kcal).toBeNull();
  });

  it('treats a skipped goal as maintain and a skipped activity as mostly sitting', () => {
    const skipped = suggestTargets(person({ sex: 'm', age: 30, heightCm: 175, weightKg: 70 }));
    const explicit = suggestTargets(
      person({
        sex: 'm',
        age: 30,
        heightCm: 175,
        weightKg: 70,
        activity: 'sedentary',
        goal: 'maintain',
      }),
    );
    expect(skipped.targets).toEqual(explicit.targets);
    expect(skipped.targets.kcal).toBe(2000); // 1648.75 × 1.2 = 1978.5 → 2000
  });
});

describe('targetsForKcal', () => {
  it('moves macros and limits with a calorie number typed in Goals', () => {
    const t = targetsForKcal(1800, { sex: 'f', age: 30, activity: 'sedentary', weightKg: 60 });
    expect(t).toMatchObject({
      kcal: 1800,
      protein_g: 68,
      fat_g: 60,
      sugar_g_limit: 45,
      fat_g_limit: 60,
    });
  });
});

describe('checkFloor', () => {
  it('uses the sex floor when body numbers are unknown', () => {
    expect(checkFloor(1400, { sex: 'm', age: null, heightCm: null, weightKg: null })).toEqual({
      floor: 1500,
      suggestion: 1500,
      below: true,
    });
    expect(checkFloor(1200, { sex: null, age: null, heightCm: null, weightKg: null })?.below).toBe(
      false,
    );
    expect(checkFloor(null, { sex: 'f', age: 30, heightCm: 160, weightKg: 60 })).toBeNull();
  });
});
