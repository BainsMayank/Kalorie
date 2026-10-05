import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAccountStore } from '@/stores/account';
import { useGroupStore } from '@/stores/group';
import { useMyFoodsStore } from '@/stores/myFoods';

/** Coming back to the front refreshes the group at most this often. */
const REFRESH_EVERY_MS = 5 * 60 * 1000;
/** Waits this long after a food changes before sending it, so a burst of changes goes once. */
const SEND_DELAY_MS = 1000;

/**
 * Keeps the person's group in step (Stage 11c). Rendered once, in the root layout. When signed
 * in: reads the group and its foods at start and when the app comes back to the front, and sends
 * the person's shared foods soon after they change (an edited recipe, a deleted product). When
 * signed out: the group's foods leave this phone's search.
 */
export function GroupEffects() {
  const account = useAccountStore((state) => state.status);
  const revision = useMyFoodsStore((state) => state.revision);

  useEffect(() => {
    const group = useGroupStore.getState();
    if (account === 'signedIn') {
      let last = Date.now();
      void group.refresh();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active' && Date.now() - last > REFRESH_EVERY_MS) {
          last = Date.now();
          void useGroupStore.getState().refresh();
        }
      });
      return () => subscription.remove();
    }
    if (account === 'signedOut') void group.forget(false).catch(() => {});
  }, [account]);

  // A food changed: send it if it is shared (does nothing when there is nothing to send).
  useEffect(() => {
    if (account !== 'signedIn') return;
    const timer = setTimeout(
      () =>
        void useGroupStore
          .getState()
          .sendPending()
          .catch(() => {}),
      SEND_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [account, revision]);

  return null;
}
