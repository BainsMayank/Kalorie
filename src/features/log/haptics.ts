import * as Haptics from 'expo-haptics';

/** A light "done" tick after something is logged (SPEC §2.4). Phones without it stay quiet. */
export function loggedTick() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
