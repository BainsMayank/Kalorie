import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { logicalDay } from '@/lib/day';

/**
 * Today's logical day (it starts at 4 am). Checked again whenever the app comes back to the
 * front, so an app left open overnight shows the right "Today" in the morning.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => logicalDay(Date.now()));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(logicalDay(Date.now()));
    });
    return () => subscription.remove();
  }, []);
  return today;
}
