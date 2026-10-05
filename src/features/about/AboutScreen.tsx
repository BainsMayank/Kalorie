import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

/** Every data source Kalorie uses, in the order shown (data/SOURCES.md has the details). */
const SOURCES = ['indb', 'ifct', 'usda', 'off', 'icmr'] as const;

const OFF_URL = 'https://world.openfoodfacts.org';
const ODBL_URL = 'https://opendatacommons.org/licenses/odbl/1-0/';

/**
 * About & data sources (SPEC §2.14): the version, and credits for every food data source —
 * including "Food data from Open Food Facts (ODbL)", which the licence asks for.
 */
export function AboutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const appName = Constants.expoConfig?.name ?? 'Kalorie';
  const version = Constants.expoConfig?.version ?? '';

  const link = (label: string, url: string) => (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [
        styles.row,
        { minHeight: minTapTarget, gap: spacing.xs, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text
        style={{ color: colors.text, fontSize: fontSize.body, textDecorationLine: 'underline' }}
      >
        {label}
      </Text>
      <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
    </Pressable>
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '600' }}
        >
          {appName}
        </Text>
        {version !== '' && (
          <Text
            style={{ color: colors.textSecondary, fontSize: fontSize.body, marginTop: spacing.xs }}
          >
            {t('aboutApp.version', { version })}
          </Text>
        )}
        <Text style={{ color: colors.text, fontSize: fontSize.body, marginTop: spacing.md }}>
          {t('aboutApp.tagline')}
        </Text>
        <Text
          style={{ color: colors.textSecondary, fontSize: fontSize.body, marginTop: spacing.md }}
        >
          {t('aboutApp.medical')}
        </Text>

        <Text
          accessibilityRole="header"
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.caption,
            fontWeight: '600',
            textTransform: 'uppercase',
            marginTop: spacing.xl,
            marginBottom: spacing.sm,
          }}
        >
          {t('aboutApp.dataTitle')}
        </Text>
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.md,
          }}
        >
          {SOURCES.map((source, index) => (
            <View
              key={source}
              style={{
                padding: spacing.lg,
                borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}>
                {t(`aboutApp.sources.${source}.name`)}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: fontSize.body,
                  marginTop: spacing.xs,
                }}
              >
                {t(`aboutApp.sources.${source}.detail`)}
              </Text>
              {source === 'off' && (
                <View style={{ marginTop: spacing.xs }}>
                  {link(t('aboutApp.offLink'), OFF_URL)}
                  {link(t('aboutApp.odblLink'), ODBL_URL)}
                </View>
              )}
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/licences')}
          style={({ pressed }) => [
            styles.row,
            {
              minHeight: minTapTarget,
              marginTop: spacing.lg,
              justifyContent: 'space-between',
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: fontSize.body }}>
            {t('aboutApp.licencesLink')}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
