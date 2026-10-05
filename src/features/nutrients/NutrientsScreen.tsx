import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChoiceChips } from '@/components';
import { foodRoute } from '@/features/foods/foodRoute';
import { useToday } from '@/features/log/useToday';
import { formatDate, formatDayName } from '@/i18n/dates';
import { MICRO_GROUPS } from '@/lib/micros';
import type { NutrientKey } from '@/lib/nutrients';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme';

import { NutrientRow } from './NutrientRow';
import { NutrientSheet } from './NutrientSheet';
import {
  NUTRIENT_PERIODS,
  useCommonFoods,
  useNutrients,
  type NutrientPeriod,
} from './useNutrients';

function validDay(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function validPeriod(value: unknown): NutrientPeriod {
  return NUTRIENT_PERIODS.includes(value as NutrientPeriod) ? (value as NutrientPeriod) : 'day';
}

/**
 * Vitamins & minerals (`app/nutrients.tsx`, SPEC §2.12): every vitamin, mineral and "other"
 * nutrient as a bar towards the ICMR-NIN need (or the person's limit), for one day or averaged
 * over the last 7 or 30 days. Opened from Today, a past day and Trends with `?day=&period=`.
 */
export function NutrientsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; period?: string }>();
  const today = useToday();
  const day = validDay(params.day) ?? today;
  const [period, setPeriod] = useState<NutrientPeriod>(validPeriod(params.period));
  const [open, setOpen] = useState<NutrientKey | null>(null);
  const data = useNutrients(day, period);
  const commonFoods = useCommonFoods();
  const diet = useSettingsStore((state) => state.diet);

  const caption = { color: colors.textSecondary, fontSize: fontSize.caption } as const;
  const rows = data.rows;
  const all = rows ? [...rows.vitamin, ...rows.mineral, ...rows.other] : [];
  const openRow = all.find((r) => r.nutrient === open) ?? null;
  const countedDays = data.countedDays ?? 0;

  const subtitle =
    period === 'day'
      ? formatDayName(t, day, today)
      : t('micros.periodLine', {
          count: countedDays,
          from: formatDate(t, data.days[0], today),
          to: formatDate(t, day, today),
        });

  const openFood = (foodId: number) => {
    setOpen(null);
    router.push(foodRoute('base', String(foodId)));
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.lg }}
    >
      <ChoiceChips<NutrientPeriod>
        label={t('micros.period')}
        choices={NUTRIENT_PERIODS.map((value) => ({
          value,
          label: t(`micros.periods.${value}`),
        }))}
        selected={period}
        onSelect={setPeriod}
      />
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '600' }}
      >
        {subtitle}
      </Text>

      {data.status === 'error' && (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
          {t('log.loadProblem')}
        </Text>
      )}

      {rows && countedDays === 0 && (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
          {period === 'day' ? t('micros.dayNone') : t('micros.periodNone')}
        </Text>
      )}

      {rows && countedDays > 0 && (
        <>
          {data.under18 && <Text style={caption}>{t('micros.under18')}</Text>}
          {all.some((r) => r.incomplete) && <Text style={caption}>{t('micros.approxNote')}</Text>}
          {MICRO_GROUPS.map(({ group }) => (
            <GroupCard key={group} title={t(`micros.groups.${group}`)}>
              {rows[group].map((row) => (
                <NutrientRow key={row.nutrient} row={row} onPress={() => setOpen(row.nutrient)} />
              ))}
            </GroupCard>
          ))}
        </>
      )}

      {openRow && data.entries && (
        <NutrientSheet
          row={openRow}
          entries={data.entries}
          dayCount={Math.max(1, countedDays)}
          commonFoods={commonFoods}
          diet={diet}
          onOpenFood={openFood}
          onClose={() => setOpen(null)}
        />
      )}
    </ScrollView>
  );
}

/** A group of nutrients (Vitamins, Minerals, Fibre, fats and sugar) on one card. */
function GroupCard({ title, children }: { title: string; children: ReactNode }) {
  const { colors, spacing, fontSize, radius } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: spacing.sm,
        },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.caption,
          fontWeight: '600',
          textTransform: 'uppercase',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xs,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
});
