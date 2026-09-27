import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatHour, formatTime } from '@/i18n/dates';
import { LOGICAL_DAY_HOURS, withHour, withMinutes } from '@/lib/day';
import { useTheme } from '@/theme';

const MINUTE_CHOICES = [0, 15, 30, 45] as const;
const HOURS_PER_ROW = 6;

type Props = {
  /** Clock minutes (minutes after midnight). */
  minute: number;
  onChange: (minute: number) => void;
};

/**
 * "Time  1:30 pm ▾". Tapping it opens a grid of the day's hours (4 am → 3 am, the way a Kalorie
 * day runs) and quarter hours, so any time is two taps away.
 */
export function TimePicker({ minute, onChange }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const [open, setOpen] = useState(false);
  const time = formatTime(t, minute);
  const hour = Math.floor(minute / 60);

  const chip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        {
          minHeight: minTapTarget,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: selected ? colors.text : colors.border,
          backgroundColor: selected ? colors.text : colors.surface,
        },
      ]}
    >
      <Text
        style={{ color: selected ? colors.background : colors.text, fontSize: fontSize.caption }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );

  const rows: number[][] = [];
  for (let i = 0; i < LOGICAL_DAY_HOURS.length; i += HOURS_PER_ROW) {
    rows.push(LOGICAL_DAY_HOURS.slice(i, i + HOURS_PER_ROW));
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('time.label', { time })}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={[styles.row, { minHeight: minTapTarget }]}
      >
        <Text style={[styles.flex, { color: colors.textSecondary, fontSize: fontSize.body }]}>
          {t('time.title')}
        </Text>
        <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}>
          {time}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
          style={{ marginLeft: spacing.xs }}
        />
      </Pressable>

      {open && (
        <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('time.hour')}
            style={{ gap: spacing.sm }}
          >
            {rows.map((row) => (
              <View key={row[0]} style={[styles.row, { gap: spacing.sm }]}>
                {row.map((h) =>
                  chip(`h${h}`, formatHour(t, h), h === hour, () => onChange(withHour(minute, h))),
                )}
              </View>
            ))}
          </View>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('time.minutes')}
            style={[styles.row, { gap: spacing.sm }]}
          >
            {MINUTE_CHOICES.map((m) =>
              chip(
                `m${m}`,
                t('time.minuteChoice', { minutes: String(m).padStart(2, '0') }),
                minute % 60 === m,
                () => onChange(withMinutes(minute, m)),
              ),
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  chip: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
