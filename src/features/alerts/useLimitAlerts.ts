import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { dismissAlerts, listAlertsForDay, markAlertsFired } from '@/db/user/alerts';
import {
  crossedLimits,
  visibleAlerts,
  type AlertKey,
  type CrossedLimit,
  type Limits,
} from '@/lib/alerts';
import type { NutrientValues } from '@/lib/nutrients';
import { useSettingsStore } from '@/stores/settings';

import { alertLine } from './alertLine';
import { notifyNow } from './notifications';

const NONE: CrossedLimit[] = [];

/**
 * Limit alerts for the Today card (SPEC §6), for today only. An alert fires the first time its
 * total reaches the limit that day: it is recorded in `limit_alerts` and, if the person turned
 * it on, a phone notification goes out — once per nutrient per day. Closing the card hides the
 * alerts it showed for the rest of the day.
 */
export function useLimitAlerts(
  day: string,
  isToday: boolean,
  totals: NutrientValues,
  limits: Limits | null,
): { alerts: CrossedLimit[]; dismiss: () => Promise<void> } {
  const { t } = useTranslation();
  const toggles = useSettingsStore((state) => state.alertsEnabled);
  const notify = useSettingsStore((state) => state.alertNotifications);
  // The alerts closed on `day`, once read from user.db (null until then, so nothing flashes).
  const [dismissed, setDismissed] = useState<{ day: string; keys: Set<AlertKey> } | null>(null);

  const crossed = useMemo(
    () => (isToday && limits ? crossedLimits(totals, limits, toggles) : NONE),
    [isToday, limits, totals, toggles],
  );
  const crossedKeys = crossed.map((c) => c.key).join(',');
  // The latest amounts, for the notification text. The effect below runs only when the set of
  // crossed limits changes, not with every gram.
  const latest = useRef({ crossed, t });
  useEffect(() => {
    latest.current = { crossed, t };
  });

  useEffect(() => {
    if (!isToday) return;
    let cancelled = false;
    listAlertsForDay(day)
      .then((rows) => {
        if (cancelled) return;
        const keys = rows.filter((r) => r.dismissedAt !== null).map((r) => r.alert);
        setDismissed({ day, keys: new Set(keys) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [day, isToday]);

  // Fire what crossed for the first time today. The database decides "first", so reopening
  // the app or re-crossing a limit never fires it twice.
  useEffect(() => {
    if (crossedKeys === '') return;
    const keys = crossedKeys.split(',') as AlertKey[];
    markAlertsFired(day, keys)
      .then((fresh) => {
        if (!notify || fresh.length === 0) return;
        const { crossed: now, t: tr } = latest.current;
        const lines = now
          .filter((c) => fresh.includes(c.key))
          .map((c) => alertLine(tr, c, useSettingsStore.getState().hideNumbers));
        return notifyNow(tr('alerts.title'), lines.join('\n'));
      })
      .catch(() => {});
  }, [day, crossedKeys, notify]);

  const ready = dismissed !== null && dismissed.day === day;
  const alerts = useMemo(
    () => (ready ? visibleAlerts(crossed, dismissed.keys) : NONE),
    [ready, crossed, dismissed],
  );

  const dismiss = useCallback(async () => {
    const keys = alerts.map((a) => a.key);
    setDismissed((prev) => ({ day, keys: new Set([...(prev?.keys ?? []), ...keys]) }));
    await dismissAlerts(day, keys);
  }, [alerts, day]);

  return { alerts, dismiss };
}
