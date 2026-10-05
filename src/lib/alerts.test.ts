import {
  ALL_ALERTS_ON,
  crossedLimits,
  parseAlertToggles,
  visibleAlerts,
  type AlertKey,
  type Limits,
} from './alerts';
import { emptyNutrients, type NutrientValues } from './nutrients';

const LIMITS: Limits = {
  fat_g_limit: 67,
  sat_fat_g_limit: 22,
  sugar_g_limit: 50,
  sodium_mg_limit: 2000,
};

const totals = (values: Partial<NutrientValues>): NutrientValues => ({
  ...emptyNutrients(),
  ...values,
});

describe('crossedLimits', () => {
  it('lists limits reached at 100% or more, with how far above', () => {
    const crossed = crossedLimits(
      totals({ fat_g: 79, sat_fat_g: 10, sugar_g: 50, sodium_mg: 1999 }),
      LIMITS,
    );
    expect(crossed.map((c) => [c.key, c.above])).toEqual([
      ['fat', 12], // "Fat is 12 g above today's limit"
      ['sugar', 0], // exactly at the limit counts
    ]);
  });

  it('never counts unknown totals, or alerts that are switched off', () => {
    expect(crossedLimits(totals({ sodium_mg: null }), LIMITS)).toEqual([]);
    expect(crossedLimits(totals({ fat_g: 100 }), LIMITS, { ...ALL_ALERTS_ON, fat: false })).toEqual(
      [],
    );
  });
});

describe('visibleAlerts', () => {
  it('hides alerts closed today and keeps the others', () => {
    const crossed = crossedLimits(totals({ fat_g: 80, sodium_mg: 2400 }), LIMITS);
    expect(visibleAlerts(crossed, new Set<AlertKey>(['fat'])).map((c) => c.key)).toEqual([
      'sodium',
    ]);
  });
});

describe('parseAlertToggles', () => {
  it('keeps every alert on unless it was switched off', () => {
    expect(parseAlertToggles(undefined)).toEqual(ALL_ALERTS_ON);
    expect(parseAlertToggles({ sugar: false, fat: 'yes' })).toEqual({
      ...ALL_ALERTS_ON,
      sugar: false,
    });
  });
});
