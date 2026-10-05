import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChoiceChips } from '@/components';
import type { Feeling } from '@/db/user/checkins';
import { formatDate } from '@/i18n/dates';
import { formatKcal, formatPercent, formatQty, formatWhole } from '@/lib/format';
import { useHideNumbers } from '@/stores/settings';
import { useTheme } from '@/theme';

import { useWeeklyCheckin } from './useWeeklyCheckin';

const FEELINGS: readonly Feeling[] = ['easy', 'okay', 'hard'];

/**
 * The weekly check-in on Today (SPEC §8.4), from Monday until it's closed: last week's days
 * logged, average vs target, best day, weight trend, one encouraging line, ONE suggestion drawn
 * from what was eaten, and "How did last week feel?". Plain monochrome: nothing here is a warning.
 * Hide numbers: no average, and the suggestion says "lower than your daily need" without a %.
 */
export function WeeklyCheckinCard({ today }: { today: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const { visible, summary, feeling, setFeeling, dismiss } = useWeeklyCheckin(today);
  const hide = useHideNumbers();
  if (!visible || !summary) return null;

  const body = { color: colors.text, fontSize: fontSize.body };
  const caption = { color: colors.textSecondary, fontSize: fontSize.caption };
  const divider = {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  };

  const { suggestion, ideas } = summary;
  let idea: string;
  if (suggestion.kind === 'nutrient') {
    const nutrient = t(`checkin.nutrients.${suggestion.nutrient}`);
    const target = suggestion.nutrient === 'protein_g' || suggestion.nutrient === 'fibre_g';
    idea = hide
      ? t(target ? 'checkin.nutrientTargetHidden' : 'checkin.nutrientNeedHidden', { nutrient })
      : t(target ? 'checkin.nutrientTarget' : 'checkin.nutrientNeed', {
          nutrient,
          percent: formatPercent(suggestion.share),
        });
    const foods = ideas.map(({ food }) =>
      t('checkin.ideaFood', {
        name: food.name,
        portion: t('food.portion', { qty: formatQty(food.qty), unit: food.unitLabel }),
      }),
    );
    if (foods.length >= 2) idea += ` ${t('checkin.ideas', { first: foods[0], second: foods[1] })}`;
    else if (foods.length === 1) idea += ` ${t('checkin.idea', { first: foods[0] })}`;
  } else if (suggestion.kind === 'water') {
    idea = t('checkin.water', {
      average: formatWhole(suggestion.averageMl),
      goal: formatWhole(suggestion.goalMl),
    });
  } else {
    idea = t(`checkin.${suggestion.kind}`);
  }

  return (
    <View
      testID="weekly-checkin"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.md,
        padding: spacing.lg,
        paddingTop: spacing.sm,
        gap: spacing.md,
      }}
    >
      <View style={styles.row}>
        <Text
          accessibilityRole="header"
          style={[styles.flex, body, { fontSize: fontSize.title, fontWeight: '600' }]}
        >
          {t('checkin.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('checkin.close')}
          onPress={() => void dismiss()}
          style={[
            styles.center,
            { width: minTapTarget, height: minTapTarget, marginRight: -spacing.md },
          ]}
        >
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text style={body}>{t('checkin.daysLogged', { count: summary.loggedDays })}</Text>
        {summary.averageKcal !== null && !hide && (
          <Text style={body}>
            {summary.targetKcal !== null
              ? t('checkin.average', {
                  average: formatKcal(summary.averageKcal),
                  target: formatKcal(summary.targetKcal),
                })
              : t('checkin.averageNoTarget', { average: formatKcal(summary.averageKcal) })}
          </Text>
        )}
        {summary.bestDay && (
          <Text style={body}>
            {t(summary.targetKcal !== null ? 'checkin.bestDayTarget' : 'checkin.bestDayTrack', {
              day: formatDate(t, summary.bestDay, today),
            })}
          </Text>
        )}
        {summary.weight && <Text style={body}>{t(`checkin.weight.${summary.weight}`)}</Text>}
        <Text style={caption}>{t(`checkin.encourage.${summary.encouragement}`)}</Text>
      </View>

      <View style={[divider, { gap: spacing.xs }]}>
        <Text style={[caption, { fontWeight: '600' }]}>{t('checkin.suggestionTitle')}</Text>
        <Text testID="checkin-suggestion" style={body}>
          {idea}
        </Text>
      </View>

      <View style={[divider, { gap: spacing.sm }]}>
        <Text style={body}>{t('checkin.feelQuestion')}</Text>
        <ChoiceChips
          label={t('checkin.feelQuestion')}
          choices={FEELINGS.map((value) => ({ value, label: t(`checkin.feelings.${value}`) }))}
          selected={feeling}
          onSelect={(value) => void setFeeling(value)}
        />
        {feeling === 'hard' && (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/goals')}
            style={{ minHeight: minTapTarget, justifyContent: 'center' }}
          >
            <Text style={caption}>
              {t('checkin.hardNote')}{' '}
              <Text style={{ color: colors.text, textDecorationLine: 'underline' }}>
                {t('checkin.openGoals')}
              </Text>
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
