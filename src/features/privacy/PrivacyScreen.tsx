import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

/** The sections, in the order shown (en.json `privacy.sections`). */
const SECTIONS = ['phone', 'account', 'where', 'group', 'sold', 'barcode', 'delete'] as const;

/**
 * Privacy (Profile → Privacy, and from the Account screen): one screen, in plain words — what is
 * kept, where, and that nothing is sold or shown to advertisers. Update it whenever what leaves
 * the phone changes (Stage 11b backup; Stage 11c group sharing).
 */
export function PrivacyScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={{ color: colors.text, fontSize: fontSize.body }}>{t('privacy.intro')}</Text>
        {SECTIONS.map((section) => (
          <View key={section} style={{ marginTop: spacing.xl }}>
            <Text
              accessibilityRole="header"
              style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}
            >
              {t(`privacy.sections.${section}.title`)}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: fontSize.body,
                marginTop: spacing.xs,
              }}
            >
              {t(`privacy.sections.${section}.body`)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
