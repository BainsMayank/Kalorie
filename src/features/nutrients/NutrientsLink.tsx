import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import type { NutrientPeriod } from './useNutrients';

/**
 * A card that opens Vitamins & minerals (SPEC §2.12) for a day (Today, a past day) or an average
 * over the days before it (Trends).
 */
export function NutrientsLink({ day, period }: { day: string; period: NutrientPeriod }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const router = useRouter();
  const title = t('micros.link');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => router.push({ pathname: '/nutrients', params: { day, period } })}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: minTapTarget + 16,
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          borderRadius: radius.md,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        },
      ]}
    >
      <Ionicons name="nutrition-outline" size={22} color={colors.textSecondary} />
      <View style={styles.flex}>
        <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}>
          {title}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
          {period === 'day' ? t('micros.linkDay') : t('micros.linkPeriod')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.iconInactive} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
});
