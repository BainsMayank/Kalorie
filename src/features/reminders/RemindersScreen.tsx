import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { TimePicker } from '@/components';
import { requestNotificationPermission } from '@/features/alerts/notifications';
import { slotName } from '@/features/log/names';
import { visibleSlots } from '@/lib/day';
import {
  MAX_REMINDERS_A_DAY,
  mealReminder,
  remindersOn,
  type ReminderSetting,
} from '@/lib/reminders';
import { useLogStore } from '@/stores/log';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme';

/**
 * Profile → Reminders (SPEC §5.12): a switch and a time for each meal, and the evening nudge for
 * scans still waiting. All off by default; switching one on asks for notification permission.
 * At most 3 can be on, so the phone never buzzes more than 3 times a day.
 */
export function RemindersScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const reminders = useSettingsStore((state) => state.reminders);
  const setReminders = useSettingsStore((state) => state.setReminders);
  const allSlots = useLogStore((state) => state.slots);
  const slots = visibleSlots(allSlots);
  const [blocked, setBlocked] = useState(false);
  const full = remindersOn(reminders, allSlots) >= MAX_REMINDERS_A_DAY;

  /** Saves one reminder's change; switching on asks for permission first. */
  const change = async (
    current: ReminderSetting,
    next: ReminderSetting,
    save: (value: ReminderSetting) => typeof reminders,
  ) => {
    setBlocked(false);
    if (next.on && !current.on) {
      const allowed = await requestNotificationPermission('reminders', t('reminders.channelName'));
      if (!allowed) {
        setBlocked(true);
        return;
      }
    }
    await setReminders(save(next));
  };

  const row = (
    key: string,
    name: string,
    reminder: ReminderSetting,
    save: (value: ReminderSetting) => typeof reminders,
    divider: boolean,
  ) => (
    <View
      key={key}
      style={{
        paddingHorizontal: spacing.lg,
        paddingBottom: reminder.on ? spacing.sm : 0,
        borderTopWidth: divider ? StyleSheet.hairlineWidth : 0,
        borderTopColor: colors.border,
      }}
    >
      <View style={[styles.row, { minHeight: minTapTarget, gap: spacing.md }]}>
        <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>{name}</Text>
        <Switch
          testID={`reminder-${key}`}
          accessibilityLabel={t('reminders.switchLabel', { name })}
          value={reminder.on}
          disabled={!reminder.on && full}
          onValueChange={(on) => void change(reminder, { ...reminder, on }, save)}
          trackColor={{ true: colors.text, false: colors.border }}
          thumbColor={colors.surface}
        />
      </View>
      {reminder.on && (
        <TimePicker
          name={t('reminders.timeLabel', { name })}
          minute={reminder.minute}
          onChange={(minute) => void change(reminder, { ...reminder, minute }, save)}
        />
      )}
    </View>
  );

  const card = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden' as const,
  };
  const heading = (label: string) => (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.textSecondary,
        fontSize: fontSize.caption,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: spacing.lg,
      }}
    >
      {label}
    </Text>
  );
  const hint = (label: string) => (
    <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>{label}</Text>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}
    >
      <Text style={{ color: colors.text, fontSize: fontSize.body }}>{t('reminders.intro')}</Text>
      {blocked && hint(t('reminders.blocked'))}
      {full && hint(t('reminders.full', { count: MAX_REMINDERS_A_DAY }))}

      {heading(t('reminders.mealsTitle'))}
      <View style={card}>
        {slots.map((slot, i) => {
          const current = mealReminder(reminders, slot);
          return row(
            slot.id,
            slotName(t, slot),
            current,
            (value) => ({ ...reminders, meals: { ...reminders.meals, [slot.id]: value } }),
            i > 0,
          );
        })}
      </View>
      {hint(t('reminders.mealsHint'))}

      {heading(t('reminders.eveningTitle'))}
      <View style={card}>
        {row(
          'scans',
          t('reminders.scansName'),
          reminders.pendingScans,
          (value) => ({ ...reminders, pendingScans: value }),
          false,
        )}
      </View>
      {hint(t('reminders.scansHint'))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
