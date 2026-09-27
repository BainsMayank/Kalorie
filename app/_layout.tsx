import '@/i18n';

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme as NavTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getFoodsDb } from '@/db/foods';
import { getUserDb } from '@/db/user/client';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme';

import migrations from '../drizzle/migrations';

export default function RootLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors, scheme } = theme;

  // 1. Create or update the tables in user.db. 2. Read the saved settings.
  const migration = useMigrations(getUserDb(), migrations);
  const settingsLoaded = useSettingsStore((state) => state.loaded);
  const loadSettings = useSettingsStore((state) => state.load);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (migration.success) {
      loadSettings().catch(() => setLoadFailed(true));
      // 3. Copy foods.db on first launch and open it, in the background. Search waits for it
      // and shows its own message if it fails, so the rest of the app still works.
      getFoodsDb().catch(() => {});
    }
  }, [migration.success, loadSettings]);

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
  } else if (!migration.success || !settingsLoaded) {
    content = (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.textSecondary} accessibilityLabel={t('app.loading')} />
      </View>
    );
  } else {
    content = (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="food/[id]"
          options={{
            headerShown: true,
            title: t('food.title'),
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
      </Stack>
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
