import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getCommonFoods, getFoodsDb, type CommonFood } from '@/db/foods';
import { listEntriesBetween } from '@/db/user/entries';
import { useRange, useTargetsFor } from '@/features/history/useHistory';
import { entryName } from '@/features/log/names';
import { entryViews, type EntryView } from '@/features/log/useDayLog';
import { useToday } from '@/features/log/useToday';
import { periodDays, periodStats, totalsByDay } from '@/lib/history';
import { microGoals, microRows, type MicroEntry } from '@/lib/micros';
import type { DayEntry } from '@/lib/nutrition';
import { foodKey } from '@/lib/suggestions';
import { ASSUMED, microRequirements } from '@/lib/targets';
import { bodyProfile, targetsOnDay, useGoalsStore } from '@/stores/goals';
import { useLogStore } from '@/stores/log';

/** One day, or an average over the last 7 or 30 days (SPEC §2.12). */
export type NutrientPeriod = 'day' | 'week' | 'month';
export const NUTRIENT_PERIODS: readonly NutrientPeriod[] = ['day', 'week', 'month'];
const PERIOD_LENGTH: Record<NutrientPeriod, number> = { day: 1, week: 7, month: 30 };

async function readViews(from: string, to: string): Promise<EntryView[]> {
  return entryViews(await listEntriesBetween(from, to));
}

/** One entry as the micronutrient sums and "where it came from" need it. */
export type NutrientEntry = MicroEntry & DayEntry;

/**
 * Vitamins, minerals and the other nutrients for `day`, or averaged over the logged days of the 7
 * or 30 days ending on it. Averages count logged days only, and today only once it looks
 * finished — the same days Trends averages (SPEC §2.11, §5.10). Reads again after every change.
 */
export function useNutrients(day: string, period: NutrientPeriod) {
  const { t } = useTranslation();
  const today = useToday();
  const revision = useLogStore((state) => state.revision);
  const days = useMemo(() => periodDays(day, PERIOD_LENGTH[period]), [day, period]);
  const views = useRange(days[0], day, revision, readViews);
  const targetsFor = useTargetsFor();
  const targetRows = useGoalsStore((state) => state.targetRows);
  const profile = useGoalsStore((state) => state.profile);
  const weightKg = useGoalsStore((state) => state.weightKg);

  const body = bodyProfile(profile, weightKg);
  const age = body.age ?? ASSUMED.age;
  const reqs = useMemo(
    () => microRequirements(body.sex ?? ASSUMED.sex, age, body.activity ?? ASSUMED.activity),
    [body.sex, age, body.activity],
  );
  const targets = useMemo(() => targetsOnDay(targetRows, day), [targetRows, day]);

  const result = useMemo(() => {
    if (views.status !== 'ready') return null;
    const all = views.value;
    let counted: string[];
    if (period === 'day') counted = all.length > 0 ? [day] : [];
    else {
      const totals = totalsByDay(all.map((v) => ({ day: v.entry.day, nutrients: v.nutrients })));
      counted = periodStats(days, totals, targetsFor, today).counted;
    }
    const countedSet = new Set(counted);
    const entries: NutrientEntry[] = all
      .filter((v) => countedSet.has(v.entry.day))
      .map((v) => ({
        entryId: v.entry.id,
        foodSource: v.entry.foodSource,
        foodId: v.entry.foodId,
        foodKey: v.entry.foodId === null ? 'quick' : foodKey(v.entry.foodSource, v.entry.foodId),
        name: entryName(t, v.entry),
        grams: v.entry.grams,
        nutrients: v.nutrients,
      }));
    return {
      entries,
      countedDays: counted.length,
      rows: microRows(entries, microGoals(reqs, targets), counted.length),
    };
  }, [views, period, day, days, targetsFor, today, t, reqs, targets]);

  return {
    status: views.status,
    /** Under 18: amounts only, no needs (SPEC §1). */
    under18: reqs === null,
    days,
    ...result,
  };
}

let commonFoods: Promise<CommonFood[]> | null = null;

/** The everyday foods for "foods rich in …", read from foods.db once. `null` while loading. */
export function useCommonFoods(): CommonFood[] | null {
  const [foods, setFoods] = useState<CommonFood[] | null>(null);
  useEffect(() => {
    let current = true;
    commonFoods ??= getFoodsDb().then(getCommonFoods);
    commonFoods
      .then((value) => current && setFoods(value))
      .catch(() => {
        commonFoods = null; // try again next time
        if (current) setFoods([]);
      });
    return () => {
      current = false;
    };
  }, []);
  return foods;
}
