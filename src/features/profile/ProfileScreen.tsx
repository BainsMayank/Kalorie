import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { slotName } from '@/features/log/names';
import { useToday } from '@/features/log/useToday';
import { LANGUAGE_PREFERENCES } from '@/i18n';
import { visibleSlots } from '@/lib/day';
import { formatKcal } from '@/lib/format';
import { DIET_PREFERENCES } from '@/lib/micros';
import { mealReminder } from '@/lib/reminders';
import { useAccountStore } from '@/stores/account';
import { useGroupStore } from '@/stores/group';
import { targetsOnDay, useGoalsStore } from '@/stores/goals';
import { useLogStore } from '@/stores/log';
import { useSettingsStore } from '@/stores/settings';
import { THEME_PREFERENCES, useTheme } from '@/theme';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const diet = useSettingsStore((state) => state.diet);
  const setDiet = useSettingsStore((state) => state.setDiet);
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const hideNumbers = useSettingsStore((state) => state.hideNumbers);
  const setHideNumbers = useSettingsStore((state) => state.setHideNumbers);
  const router = useRouter();
  const today = useToday();
  const kcal = useGoalsStore((state) => targetsOnDay(state.targetRows, today)?.kcal ?? null);
  const accountStatus = useAccountStore((state) => state.status);
  const accountEmail = useAccountStore((state) => state.email);
  const groupName = useGroupStore((state) => state.group?.name ?? null);
  const reminders = useSettingsStore((state) => state.reminders);
  const slots = useLogStore((state) => state.slots);
  // "Lunch, Dinner" — the reminders switched on, or "Off".
  const remindersOn = [
    ...visibleSlots(slots)
      .filter((slot) => mealReminder(reminders, slot).on)
      .map((slot) => slotName(t, slot)),
    ...(reminders.pendingScans.on ? [t('reminders.summaryScans')] : []),
  ];

  const sectionTitle = (label: string) => (
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
      {label}
    </Text>
  );
  const card = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden' as const,
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '600' }}
        >
          {t('tabs.profile')}
        </Text>

        <View style={[card, { marginTop: spacing.xl }]}>
          <NavRow
            title={t('profile.goals')}
            detail={
              kcal === null
                ? t('profile.goalsTrack')
                : hideNumbers
                  ? t('profile.goalsHidden')
                  : t('profile.goalsKcal', { kcal: formatKcal(kcal) })
            }
            onPress={() => router.push('/goals')}
          />
          <NavRow
            title={t('profile.recipes')}
            detail={t('profile.recipesHint')}
            onPress={() => router.push('/recipes')}
            divider
          />
          <NavRow
            title={t('profile.reminders')}
            detail={remindersOn.length > 0 ? remindersOn.join(', ') : t('profile.remindersOff')}
            onPress={() => router.push('/reminders')}
            divider
          />
        </View>

        {sectionTitle(t('profile.account'))}
        <View style={card}>
          {accountStatus !== 'notSetUp' && (
            <NavRow
              title={t('profile.account')}
              detail={
                accountStatus === 'signedIn'
                  ? t('profile.accountSignedIn', { email: accountEmail })
                  : t('profile.accountOptional')
              }
              onPress={() => router.push('/account')}
            />
          )}
          {accountStatus !== 'notSetUp' && (
            <NavRow
              title={t('profile.group')}
              detail={groupName ?? t('profile.groupHint')}
              onPress={() => router.push('/group')}
              divider
            />
          )}
          <NavRow
            title={t('profile.privacy')}
            detail={t('profile.privacyHint')}
            onPress={() => router.push('/privacy')}
            divider={accountStatus !== 'notSetUp'}
          />
        </View>

        {sectionTitle(t('profile.food'))}
        <RadioCard
          label={t('profile.diet')}
          options={DIET_PREFERENCES.map((value) => ({
            value,
            label: t(`profile.dietOptions.${value}`),
          }))}
          selected={diet}
          onSelect={(value) => void setDiet(value)}
        />
        <Text
          style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: spacing.sm }}
        >
          {t('profile.dietHint')}
        </Text>

        {sectionTitle(t('profile.numbers'))}
        <View style={card}>
          <View
            style={[
              styles.row,
              { minHeight: minTapTarget + 16, paddingHorizontal: spacing.lg, gap: spacing.md },
            ]}
          >
            <View style={styles.flex}>
              <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}>
                {t('profile.hideNumbers')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                {t('profile.hideNumbersHint')}
              </Text>
            </View>
            <Switch
              testID="hide-numbers"
              accessibilityLabel={t('profile.hideNumbers')}
              accessibilityHint={t('profile.hideNumbersHint')}
              value={hideNumbers}
              onValueChange={(on) => void setHideNumbers(on)}
              trackColor={{ true: colors.text, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {sectionTitle(t('profile.appearance'))}
        <RadioCard
          label={t('profile.theme')}
          options={THEME_PREFERENCES.map((value) => ({
            value,
            label: t(`profile.themeOptions.${value}`),
          }))}
          selected={theme}
          onSelect={(value) => void setTheme(value)}
        />

        {sectionTitle(t('profile.language'))}
        <RadioCard
          label={t('profile.language')}
          options={LANGUAGE_PREFERENCES.map((value) => ({
            value,
            label: t(`profile.languageOptions.${value}`),
          }))}
          selected={language}
          onSelect={(value) => void setLanguage(value)}
        />

        <View style={[card, { marginTop: spacing.xl }]}>
          <NavRow
            title={t('profile.export')}
            detail={t('profile.exportHint')}
            onPress={() => router.push('/export')}
          />
          <NavRow title={t('profile.about')} onPress={() => router.push('/about')} divider />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A card of choices where one is picked, each a full-width row with ✓ (theme, diet). */
function RadioCard<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.md,
        overflow: 'hidden',
      }}
    >
      {options.map((option, index) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: isSelected }}
            onPress={() => onSelect(option.value)}
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
              {option.label}
            </Text>
            {isSelected && <Ionicons name="checkmark" size={22} color={colors.text} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A row that opens another screen: title, an optional line under it, and ›. */
function NavRow({
  title,
  detail,
  onPress,
  divider = false,
}: {
  title: string;
  detail?: string;
  onPress: () => void;
  /** A line above it, when it follows another row in the same card. */
  divider?: boolean;
}) {
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: detail ? minTapTarget + 16 : minTapTarget,
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          borderTopWidth: divider ? StyleSheet.hairlineWidth : 0,
          borderTopColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        },
      ]}
    >
      <View style={styles.flex}>
        <Text
          style={{
            color: colors.text,
            fontSize: fontSize.body,
            fontWeight: detail ? '600' : 'normal',
          }}
        >
          {title}
        </Text>
        {detail && (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>{detail}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
