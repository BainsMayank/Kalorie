import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

/** Shown on Today for a day with no entries: a friendly word and one button to start. */
export function EmptyDay({ isToday }: { isToday: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();

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
        {isToday ? t('today.empty.today') : t('today.empty.otherDay')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('today.empty.add')}
        onPress={() => router.push('/add')}
        style={({ pressed }) => [
          styles.button,
          {
            minHeight: minTapTarget,
            paddingHorizontal: spacing.xl,
            gap: spacing.xs,
            borderRadius: radius.lg * 2,
            backgroundColor: colors.text,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons name="add" size={20} color={colors.background} />
        <Text style={{ color: colors.background, fontSize: fontSize.body, fontWeight: '600' }}>
          {t('today.empty.add')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
