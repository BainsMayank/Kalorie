import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettingsStore } from '@/stores/settings';
import { THEME_PREFERENCES, useTheme } from '@/theme';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '600' }}
        >
          {t('tabs.profile')}
        </Text>

        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.caption,
            fontWeight: '600',
            textTransform: 'uppercase',
            marginTop: spacing.xl,
            marginBottom: spacing.sm,
          }}
        >
          {t('profile.appearance')}
        </Text>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('profile.theme')}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          {THEME_PREFERENCES.map((option, index) => {
            const selected = option === theme;
            const label = t(`profile.themeOptions.${option}`);
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: selected }}
                onPress={() => void setTheme(option)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    minHeight: minTapTarget,
                    paddingHorizontal: spacing.lg,
                    backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                    borderTopColor: colors.border,
                    borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>
                  {label}
                </Text>
                {selected && <Ionicons name="checkmark" size={22} color={colors.text} />}
              </Pressable>
            );
          })}
        </View>

        <Text
          style={{ color: colors.textSecondary, fontSize: fontSize.body, marginTop: spacing.xl }}
        >
          {t('profile.moreSoon')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
