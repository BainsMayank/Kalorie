import '@/i18n';

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme as NavTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';

import { getFoodsDb } from '@/db/foods';
import { getUserDb } from '@/db/user/client';
import { purgeDeletedRows } from '@/db/user/purge';
import { GroupEffects } from '@/features/group/GroupEffects';
import { ReminderEffects } from '@/features/reminders/ReminderEffects';
import { useAccountStore } from '@/stores/account';
import { useBarcodeQueueStore } from '@/stores/barcodeQueue';
import { useFavouritesStore } from '@/stores/favourites';
import { useGoalsStore } from '@/stores/goals';
import { useLogStore } from '@/stores/log';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme';

import migrations from '../drizzle/migrations';

export default function RootLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors, scheme } = theme;

  // 1. Create or update the tables in user.db. 2. Read settings, meal slots, favourites and
  // goals (profile + targets).
  const migration = useMigrations(getUserDb(), migrations);
  const settingsLoaded = useSettingsStore((state) => state.loaded);
  const loadSettings = useSettingsStore((state) => state.load);
  const slotsLoaded = useLogStore((state) => state.loaded);
  const loadSlots = useLogStore((state) => state.load);
  const favouritesLoaded = useFavouritesStore((state) => state.loaded);
  const loadFavourites = useFavouritesStore((state) => state.load);
  const goalsLoaded = useGoalsStore((state) => state.loaded);
  const loadGoals = useGoalsStore((state) => state.load);
  const onboarded = useGoalsStore((state) => state.profile?.onboardedAt != null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (migration.success) {
      Promise.all([loadSettings(), loadSlots(), loadFavourites(), loadGoals()]).catch(() =>
        setLoadFailed(true),
      );
      // 3. Copy foods.db on first launch and open it, in the background. Search waits for it
      // and shows its own message if it fails, so the rest of the app still works.
      getFoodsDb().catch(() => {});
      // 4. Remove what was deleted more than 30 days ago (SPEC §4.2). Quiet if it fails: it
      // tries again next time.
      purgeDeletedRows().catch(() => {});
    }
  }, [migration.success, loadSettings, loadSlots, loadFavourites, loadGoals]);

  // 5. Barcodes scanned while offline: look them up again now, and whenever the app comes back
  // to the front (the likeliest moment to be back online). Quiet if it fails: the Pending
  // lookups card on Today keeps them.
  useEffect(() => {
    if (!migration.success) return;
    const queue = useBarcodeQueueStore.getState();
    queue
      .load()
      .then(() => queue.retry())
      .catch(() => {});
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active')
        useBarcodeQueueStore
          .getState()
          .retry()
          .catch(() => {});
    });
    return () => subscription.remove();
  }, [migration.success]);

  // 6. The optional account (Stage 11a): follow sign-ins and sign-outs. Supabase reads its saved
  // session from secure storage by itself, so this doesn't wait for user.db.
  useEffect(() => useAccountStore.getState().start(), []);

  // Colours for the tab bar and other navigation parts.
  const navTheme = useMemo<NavTheme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.text,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.notice,
      },
    };
  }, [scheme, colors]);

  let content: React.ReactNode;
  if (migration.error || loadFailed) {
    content = (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, fontSize: theme.fontSize.body, textAlign: 'center' }}>
          {t('app.startupProblem')}
        </Text>
      </View>
    );
  } else if (
    !migration.success ||
    !settingsLoaded ||
    !slotsLoaded ||
    !favouritesLoaded ||
    !goalsLoaded
  ) {
    content = (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.textSecondary} accessibilityLabel={t('app.loading')} />
      </View>
    );
  } else {
    content = (
      // Until onboarding is finished (or skipped) only the onboarding screen can be opened.
      <>
        {onboarded && <ReminderEffects />}
        {onboarded && <GroupEffects />}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="add/index"
              options={{
                headerShown: true,
                title: t('add.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="food/[id]"
              options={{
                headerShown: true,
                title: t('food.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="day/[day]"
              options={{
                headerShown: true,
                title: t('history.dayTitle'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="nutrients"
              options={{
                headerShown: true,
                title: t('micros.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="goals"
              options={{
                headerShown: true,
                title: t('goals.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="scan"
              options={{
                headerShown: true,
                title: t('scan.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="label"
              options={{
                headerShown: true,
                title: t('label.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="recipes"
              options={{
                headerShown: true,
                title: t('recipe.listTitle'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="recipe"
              options={{
                headerShown: true,
                title: t('recipe.newTitle'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="recipe-ingredient"
              options={{
                headerShown: true,
                title: t('recipe.pickerTitle'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="about"
              options={{
                headerShown: true,
                title: t('aboutApp.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="licences"
              options={{
                headerShown: true,
                title: t('licences.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="reminders"
              options={{
                headerShown: true,
                title: t('reminders.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="export"
              options={{
                headerShown: true,
                title: t('export.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="account"
              options={{
                headerShown: true,
                title: t('account.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="group"
              options={{
                headerShown: true,
                title: t('group.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="privacy"
              options={{
                headerShown: true,
                title: t('privacy.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
          </Stack.Protected>
        </Stack>
      </>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {content}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
