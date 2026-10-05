import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PillButton } from '@/components';
import { useTheme } from '@/theme';

/**
 * Shown on Today for a day with no entries: a friendly word and one button to start. Read-only
 * (a past day opened from the calendar): just the word.
 */
export function EmptyDay({ isToday, readOnly = false }: { isToday: boolean; readOnly?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.xl,
          gap: spacing.md,
        },
      ]}
    >
      <Ionicons name="restaurant-outline" size={32} color={colors.textSecondary} />
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '600' }}
      >
        {t('today.empty.title')}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.body,
          textAlign: 'center',
          lineHeight: 22,
        }}
      >
        {readOnly
          ? t('history.emptyDay')
          : isToday
            ? t('today.empty.today')
            : t('today.empty.otherDay')}
      </Text>
      {!readOnly && (
        <PillButton
          kind="filled"
          icon="add"
          label={t('today.empty.add')}
          onPress={() => router.push('/add')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
});
