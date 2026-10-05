import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CrossedLimit } from '@/lib/alerts';
import { useHideNumbers } from '@/stores/settings';
import { useTheme } from '@/theme';

import { alertLine } from './alertLine';

/**
 * The calm limits card on Today (SPEC §6): one soft-amber card listing every limit reached today,
 * a gentle next step, and ✕ to close it for the day. Never red, no alarm words.
 */
export function AlertCard({
  alerts,
  onDismiss,
}: {
  alerts: CrossedLimit[];
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const hide = useHideNumbers();
  if (alerts.length === 0) return null;

  return (
    <View
      testID="alert-card"
      accessibilityRole="summary"
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderLeftColor: colors.notice,
          borderRadius: radius.md,
          paddingLeft: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.md,
        },
      ]}
    >
      <Ionicons name="information-circle-outline" size={22} color={colors.notice} />
      <View style={[styles.flex, { gap: spacing.xs }]}>
        {alerts.map((alert) => (
          <Text key={alert.key} style={{ color: colors.text, fontSize: fontSize.body }}>
            {alertLine(t, alert, hide)}
          </Text>
        ))}
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
          {t('alerts.nextStep')}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('alerts.close')}
        onPress={onDismiss}
        style={[
          styles.center,
          { width: minTapTarget, height: minTapTarget, marginTop: -spacing.md },
        ]}
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
});
