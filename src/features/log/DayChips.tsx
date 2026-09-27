import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate } from '@/i18n/dates';
import { addDays } from '@/lib/day';
import { useTheme } from '@/theme';

type Props = {
  value: string;
  today: string;
  onChange: (day: string) => void;
  /** Called by the calendar chip; the parent shows a calendar. */
  onPickDate: () => void;
  /** Also offer Tomorrow (copying ahead). */
  withTomorrow?: boolean;
};

/** Yesterday · Today · (Tomorrow) · 📅 Pick a date — the last shows the date when it's picked. */
export function DayChips({ value, today, onChange, onPickDate, withTomorrow = false }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();

  const days = [
    { day: addDays(today, -1), label: t('date.yesterday') },
    { day: today, label: t('date.today') },
    ...(withTomorrow ? [{ day: addDays(today, 1), label: t('date.tomorrow') }] : []),
  ];
  const otherDay = !days.some((d) => d.day === value);

  const chip = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    icon = false,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        {
          minHeight: minTapTarget,
          paddingHorizontal: spacing.lg,
          gap: spacing.xs,
          borderRadius: radius.lg * 2,
          borderWidth: 1,
          borderColor: selected ? colors.text : colors.border,
          backgroundColor: selected ? colors.text : colors.surface,
        },
      ]}
    >
      {icon && (
        <Ionicons
          name="calendar-outline"
          size={18}
          color={selected ? colors.background : colors.text}
        />
      )}
      <Text style={{ color: selected ? colors.background : colors.text, fontSize: fontSize.body }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      {days.map((d) => chip(d.day, d.label, d.day === value, () => onChange(d.day)))}
      {chip(
        'pick',
        otherDay ? formatDate(t, value, today) : t('date.pick'),
        otherDay,
        onPickDate,
        true,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
