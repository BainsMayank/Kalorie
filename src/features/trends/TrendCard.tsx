import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TFunction } from 'i18next';

import { parseDay, weekday } from '@/lib/day';
import { useTheme } from '@/theme';

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** A Trends section: a title, an optional line under it, and its chart. */
export function TrendCard({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string | null;
  children?: ReactNode;
}) {
  const { colors, spacing, fontSize, radius } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.lg,
          gap: spacing.md,
        },
      ]}
    >
      <View style={{ gap: 2 }}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}
        >
          {title}
        </Text>
        {summary ? (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>{summary}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * The label under a day in a chart: the weekday for a week ("Mon"); for a month only every 7th
 * day, counting back from today, as its date ("14").
 */
export function dayLabel(t: TFunction, days: readonly string[], index: number): string {
  const day = days[index];
  if (days.length <= 7) return t(`date.weekdays.${WEEKDAYS[weekday(day)]}`);
  return (days.length - 1 - index) % 7 === 0 ? String(parseDay(day).date) : '';
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
});
