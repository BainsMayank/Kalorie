import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomSheet } from '@/components';
import { formatDate, formatDayName } from '@/i18n/dates';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { DayCalendar } from './DayCalendar';
import { DayChips } from './DayChips';
import { useToday } from './useToday';

/** The day shown at the top of the Log tab, with Yesterday · Today · Pick a date. */
export function DateSwitcher() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const day = useLogStore((state) => state.day);
  const setDay = useLogStore((state) => state.setDay);
  const [picking, setPicking] = useState(false);
  const today = useToday();
  const name = formatDayName(t, day, today);
  const date = formatDate(t, day, today);

  return (
    <View>
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '600' }}
      >
        {name}
      </Text>
      {name !== date && (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.body, marginTop: 2 }}>
          {date}
        </Text>
      )}
      <View style={{ marginTop: spacing.md }}>
        <DayChips value={day} today={today} onChange={setDay} onPickDate={() => setPicking(true)} />
      </View>

      {picking && (
        <BottomSheet title={t('date.pick')} onClose={() => setPicking(false)}>
          <DayCalendar
            day={day}
            onPick={(picked) => {
              setDay(picked);
              setPicking(false);
            }}
          />
        </BottomSheet>
      )}
    </View>
  );
}
