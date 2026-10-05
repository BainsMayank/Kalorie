import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { setNotificationHandler } from '@/features/alerts/notifications';
import { logicalDay } from '@/lib/day';
import { useBarcodeQueueStore } from '@/stores/barcodeQueue';
import { useLogStore } from '@/stores/log';
import { useSettingsStore } from '@/stores/settings';

import { syncReminders, type ReminderData } from './schedule';

/** Waits this long after a change before re-planning, so a burst of changes plans once. */
const SYNC_DELAY_MS = 500;

// One sync at a time: a new one waits for the last to finish.
let queue: Promise<void> = Promise.resolve();

/**
 * Keeps reminders up to date and opens the right screen when one is tapped. Rendered once, in
 * the root layout, after onboarding. It re-plans (SPEC §5.12) when the app opens or comes back to
 * the front, and after any change to entries, meal slots, reminder settings or the scan queue.
 */
export function ReminderEffects() {
  const { t } = useTranslation();
  const router = useRouter();
  const revision = useLogStore((state) => state.revision);
  const slots = useLogStore((state) => state.slots);
  const reminders = useSettingsStore((state) => state.reminders);
  const hasPendingScans = useBarcodeQueueStore((state) => state.items.length > 0);
  const [opened, setOpened] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setOpened((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      queue = queue
        .then(() => syncReminders(t, { reminders, slots, hasPendingScans }))
        .catch(() => {}); // quiet: the next change or app open tries again
    }, SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [t, revision, slots, reminders, hasPendingScans, opened]);

  // A tapped meal reminder opens Add food for that meal on today; the scans nudge opens Today.
  useEffect(() => {
    setNotificationHandler();
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as ReminderData | undefined;
      if (data?.kind !== 'reminder') return;
      useLogStore.getState().setDay(logicalDay(Date.now()));
      if (data.slotId) router.push({ pathname: '/add', params: { slot: data.slotId } });
      else router.navigate('/');
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    // Tapped while the app was closed: it starts with that response waiting.
    Notifications.getLastNotificationResponseAsync()
      .then(open)
      .catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [router]);

  return null;
}
