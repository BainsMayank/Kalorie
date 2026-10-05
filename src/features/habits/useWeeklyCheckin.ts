import { useCallback, useEffect, useMemo, useState } from 'react';

import { dismissCheckin, getCheckin, saveFeeling, type Feeling } from '@/db/user/checkins';
import { listEntriesBetween } from '@/db/user/entries';
import type { WeeklyCheckinRow } from '@/db/user/schema';
import { useRange, useTargetsFor, useWaterByDay } from '@/features/history/useHistory';
import { entryViews, type EntryView } from '@/features/log/useDayLog';
import { useCommonFoods } from '@/features/nutrients/useNutrients';
import {
  bestDay,
  encouragement,
  foodIdeas,
  isReliable,
  pickSuggestion,
  reviewedWeek,
  SUGGESTION_NUTRIENTS,
  type NutrientAverage,
} from '@/lib/checkin';
import { averageWater, periodStats, totalsByDay } from '@/lib/history';
import { coverage, microGoals, microRows, type MicroEntry } from '@/lib/micros';
import { foodKey } from '@/lib/suggestions';
import { ASSUMED, microRequirements } from '@/lib/targets';
import { trendDirection, weeklyChange, weightTrend } from '@/lib/trend';
import { bodyProfile, targetsOnDay, useGoalsStore } from '@/stores/goals';
import { useLogStore } from '@/stores/log';
import { useSettingsStore } from '@/stores/settings';

async function readViews(from: string, to: string): Promise<EntryView[]> {
  return entryViews(await listEntriesBetween(from, to));
}

/**
 * Last week (Monday–Sunday) for the check-in card on Today (SPEC §8.4): days logged, the average
 * against the target, the best day, the weight trend, and one suggestion with food ideas. The
 * card is there from Monday until it's closed; `summary` is `null` while loading, and when
 * nothing was logged last week (a missed week gets no message at all).
 */
export function useWeeklyCheckin(today: string) {
  const { start, days } = useMemo(() => reviewedWeek(today), [today]);
  const lastDay = days[days.length - 1];
  const revision = useLogStore((state) => state.revision);
  const views = useRange(start, lastDay, revision, readViews);
  const water = useWaterByDay(start, lastDay);
  const targetsFor = useTargetsFor();
  const targetRows = useGoalsStore((state) => state.targetRows);
  const profile = useGoalsStore((state) => state.profile);
  const weightKg = useGoalsStore((state) => state.weightKg);
  const weighIns = useGoalsStore((state) => state.weighIns);
  const diet = useSettingsStore((state) => state.diet);
  const waterGoalMl = useSettingsStore((state) => state.waterGoalMl);
  const commonFoods = useCommonFoods();

  const body = bodyProfile(profile, weightKg);
  const age = body.age ?? ASSUMED.age;
  const reqs = useMemo(
    () => microRequirements(body.sex ?? ASSUMED.sex, age, body.activity ?? ASSUMED.activity),
    [body.sex, age, body.activity],
  );

  // The week's check-in row: its feeling and whether it was closed.
  const [row, setRow] = useState<{ start: string; row: WeeklyCheckinRow | null } | null>(null);
  useEffect(() => {
    let current = true;
    getCheckin(start)
      .then((found) => current && setRow({ start, row: found }))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [start]);

  const summary = useMemo(() => {
    if (views.status !== 'ready') return null;
    const all = views.value;
    const totals = totalsByDay(all.map((v) => ({ day: v.entry.day, nutrients: v.nutrients })));
    const stats = periodStats(days, totals, targetsFor, today);
    const loggedDays = stats.countedDays;
    if (loggedDays === 0) return null;

    const entries: MicroEntry[] = all.map((v) => ({
      entryId: v.entry.id,
      foodKey: v.entry.foodId === null ? 'quick' : foodKey(v.entry.foodSource, v.entry.foodId),
      name: v.entry.name,
      grams: v.entry.grams,
      nutrients: v.nutrients,
    }));
    const kcal = (list: EntryView[]) =>
      list.reduce((sum, v) => sum + (v.nutrients.energy_kcal ?? 0), 0);
    const allKcal = kcal(all);
    const quickKcalShare =
      allKcal > 0 ? kcal(all.filter((v) => v.entry.foodSource === 'quick')) / allKcal : 0;

    // Each nutrient's average against its need (protein and fibre: the person's own targets).
    const weekTargets = targetsOnDay(targetRows, lastDay);
    const rows = microRows(entries, microGoals(reqs, weekTargets), loggedDays);
    const microRow = (n: string) =>
      [...rows.vitamin, ...rows.mineral, ...rows.other].find((r) => r.nutrient === n);
    const nutrients: NutrientAverage[] = SUGGESTION_NUTRIENTS.map((nutrient) => {
      if (nutrient === 'protein_g') {
        const eaten = stats.average.protein_g;
        const target = stats.averageTarget.protein_g;
        return {
          nutrient,
          share: eaten !== null && target ? eaten / target : null,
          reliable: isReliable(coverage(entries, nutrient), quickKcalShare),
        };
      }
      const found = microRow(nutrient);
      return {
        nutrient,
        share: found?.share ?? null,
        reliable: found ? isReliable(found.coverage, quickKcalShare) : false,
      };
    });

    const waterMl = water.status === 'ready' ? averageWater(days, water.value) : null;
    const suggestion = pickSuggestion({
      loggedDays,
      nutrients,
      water: { averageMl: waterMl, goalMl: waterGoalMl },
    });
    const eaten = new Set(
      all.filter((v) => v.entry.foodSource === 'base').map((v) => Number(v.entry.foodId)),
    );
    const ideas =
      suggestion.kind === 'nutrient' && commonFoods
        ? foodIdeas(commonFoods, suggestion.nutrient, diet, eaten)
        : [];

    // The weight trend's direction up to the end of the week, once there's a week of weigh-ins.
    const change = weeklyChange(
      weightTrend(
        weighIns.filter((w) => w.day <= lastDay).map((w) => ({ day: w.day, kg: w.weightKg })),
      ),
    );

    return {
      loggedDays,
      encouragement: encouragement(loggedDays),
      averageKcal: stats.average.kcal,
      targetKcal: stats.averageTarget.kcal,
      bestDay: bestDay(days, totals, targetsFor),
      weight: change === null ? null : trendDirection(change),
      suggestion,
      ideas,
    };
  }, [
    views,
    water,
    days,
    lastDay,
    targetsFor,
    today,
    targetRows,
    reqs,
    waterGoalMl,
    commonFoods,
    diet,
    weighIns,
  ]);

  const current = row?.start === start ? row.row : undefined;

  const setFeeling = useCallback(
    async (feeling: Feeling) => {
      setRow((r) => ({ start, row: { ...emptyRow(start), ...r?.row, feeling } }));
      await saveFeeling(start, feeling);
    },
    [start],
  );
  const dismiss = useCallback(async () => {
    setRow((r) => ({ start, row: { ...emptyRow(start), ...r?.row, dismissedAt: Date.now() } }));
    await dismissCheckin(start);
  }, [start]);

  return {
    /** Shown when last week has something logged and the card wasn't closed. */
    visible: summary !== null && current !== undefined && current?.dismissedAt == null,
    summary,
    feeling: current?.feeling ?? null,
    setFeeling,
    dismiss,
  };
}

function emptyRow(weekStart: string): WeeklyCheckinRow {
  return { weekStart, feeling: null, dismissedAt: null, createdAt: Date.now() };
}
