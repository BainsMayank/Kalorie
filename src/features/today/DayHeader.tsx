import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components';
import { DayCalendar } from '@/features/log/DayCalendar';
import { formatDate, formatDayName } from '@/i18n/dates';
import { addDays } from '@/lib/day';
import { useTheme } from '@/theme';

type Props = { day: string; today: string; onChange: (day: string) => void };

/**
 * "Today" (or the day's name) with its date, ‹ › to step a day back or forward, and a tap on
 * the name for a calendar (SPEC §2.2). There is nothing to see after today, so › stops there.
 */
export function DayHeader({ day, today, onChange }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const [picking, setPicking] = useState(false);
  const name = formatDayName(t, day, today);
  const date = formatDate(t, day, today);
  const canGoForward = day < today;

  const arrow = (
    icon: 'chevron-back' | 'chevron-forward',
    label: string,
    to: string,
    on = true,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !on }}
      disabled={!on}
      onPress={() => onChange(to)}
      style={({ pressed }) => [
        styles.center,
        { width: minTapTarget, height: minTapTarget, opacity: !on ? 0.3 : pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={24} color={colors.text} />
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {arrow('chevron-back', t('today.previousDay'), addDays(day, -1))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name === date ? name : `${name}, ${date}`}
        accessibilityHint={t('today.pickDayHint')}
        onPress={() => setPicking(true)}
        style={({ pressed }) => [
          styles.center,
          styles.flex,
          { minHeight: minTapTarget, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '600' }}
        >
          {name}
        </Text>
        {name !== date && (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: 2 }}>
            {date}
          </Text>
        )}
      </Pressable>
      {arrow('chevron-forward', t('today.nextDay'), addDays(day, 1), canGoForward)}

      {picking && (
        <BottomSheet title={t('date.pick')} onClose={() => setPicking(false)}>
          <View style={{ paddingBottom: spacing.md }}>
            <DayCalendar
              day={day}
              onPick={(picked) => {
                onChange(picked);
                setPicking(false);
              }}
            />
          </View>
        </BottomSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
