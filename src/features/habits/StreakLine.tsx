import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components';
import { useTheme } from '@/theme';

import { useStreak } from './useStreak';

/**
 * The streak on Today, kept small (SPEC §2.2, §7): "12 day streak · 2 free days left this week".
 * Nothing at all when there's no streak — a missed day gets no message and there are no
 * "streak lost" pop-ups. Tapping it explains how it works.
 */
export function StreakLine({ today }: { today: string }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const streak = useStreak(today);
  const [explaining, setExplaining] = useState(false);
  if (!streak || streak.days === 0) return null;

  const parts = [t('streak.days', { count: streak.days })];
  if (streak.freeDaysLeft > 0) parts.push(t('streak.freeLeft', { count: streak.freeDaysLeft }));
  const text = parts.join(' · ');

  return (
    <>
      <Pressable
        testID="streak"
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityHint={t('streak.hint')}
        onPress={() => setExplaining(true)}
        style={({ pressed }) => [
          styles.row,
          { minHeight: minTapTarget, gap: spacing.xs, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Ionicons name="flame-outline" size={16} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>{text}</Text>
      </Pressable>

      {explaining && (
        <BottomSheet title={t('streak.sheetTitle')} onClose={() => setExplaining(false)}>
          <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            <Text style={{ color: colors.text, fontSize: fontSize.body }}>{text}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
              {t('streak.sheetBody')}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
              {t('streak.sheetFree')}
            </Text>
          </View>
        </BottomSheet>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
