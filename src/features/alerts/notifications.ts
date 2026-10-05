// Phone notifications: the optional limit alert (SPEC §6 rule 4b) and reminders (SPEC §5.12), both
// off by default. Local only: nothing is sent to a server (CLAUDE.md stack: expo-notifications,
// local only), which is also why they work in Expo Go.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Android groups notifications in channels the person can switch off one by one. */
export type ChannelId = 'limits' | 'reminders';

let handlerSet = false;

/**
 * How a notification behaves while Kalorie is open: a limit alert shows quietly (no sound, no
 * badge); a reminder doesn't show at all — the person is already in the app.
 */
export function setNotificationHandler() {
  if (handlerSet) return;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const show = notification.request.content.data?.kind !== 'reminder';
      return {
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });
  handlerSet = true;
}

/** Creates the Android channel (safe to repeat); nothing on iOS. */
export async function ensureChannel(id: ChannelId, name: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(id, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Asks for permission to show notifications (Android needs a channel first). Returns whether
 * they are allowed; `channelName` is what Android shows in the phone's settings.
 */
export async function requestNotificationPermission(
  channel: ChannelId,
  channelName: string,
): Promise<boolean> {
  await ensureChannel(channel, channelName);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Whether notifications are allowed right now (without asking). */
export async function notificationsAllowed(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Shows a limit alert now. Failures are ignored: the card on Today still shows. */
export async function notifyNow(title: string, body: string): Promise<void> {
  try {
    setNotificationHandler();
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: Platform.OS === 'android' ? { channelId: 'limits' } : null,
    });
  } catch {
    // No permission or no notification support: the Today card is enough.
  }
}
