import { useEffect, useState } from 'react';

import { listLoggedDays } from '@/db/user/entries';
import { forgivingStreak, type Streak } from '@/lib/streak';
import { useLogStore } from '@/stores/log';

/**
 * The forgiving streak up to `today` (SPEC §5.7), read again after every change to entries.
 * `null` while loading.
 */
export function useStreak(today: string): Streak | null {
  const revision = useLogStore((state) => state.revision);
  const [state, setState] = useState<{ today: string; streak: Streak } | null>(null);

  useEffect(() => {
    let current = true;
    listLoggedDays(today)
      .then((days) => current && setState({ today, streak: forgivingStreak(new Set(days), today) }))
      .catch(() => {}); // the streak is extra: nothing shows if it can't be read
    return () => {
      current = false;
    };
  }, [today, revision]);

  return state?.today === today ? state.streak : null;
}
