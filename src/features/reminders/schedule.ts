// Turns the reminder plan (src/lib/reminders.ts) into scheduled phone notifications. Every sync
// cancels Kalorie's scheduled reminders and schedules the new plan, so a meal logged, a setting
// changed or a scan finished is reflected straight away. Limit alerts are sent at once, never
// scheduled, so they aren't touched.

import type { TFunction } from 'i18next';
import * as Notifications from 'expo-notifications';

import { listEntriesBetween } from '@/db/user/entries';
import type { MealSlot } from '@/db/user/schema';
import { ensureChannel, notificationsAllowed } from '@/features/alerts/notifications';
import { slotName } from '@/features/log/names';
import { addDays, logicalDay } from '@/lib/day';
import {
  PLAN_DAYS,
  planReminders,
  remindersOn,
  type PlannedReminder,
  type ReminderSettings,
} from '@/lib/reminders';

/** Scheduled reminders' ids start with this, so they can be told apart from anything else. */
const ID_PREFIX = 'reminder:';

/** What a tapped reminder carries: where to go. */
export interface ReminderData extends Record<string, unknown> {
  kind: 'reminder';
  /** The meal to add to; `null` for the pending scans nudge (it opens Today). */
  slotId: string | null;
}

const BUILTIN_LINES = new Set(['breakfast', 'lunch', 'snacks', 'dinner']);

function content(t: TFunction, reminder: PlannedReminder, slots: readonly MealSlot[]) {
  const data: ReminderData = { kind: 'reminder', slotId: reminder.slotId };
  if (reminder.kind === 'pendingScans') {
    return { title: t('reminders.scansTitle'), body: t('reminders.scansBody'), data };
  }
  const slot = slots.find((s) => s.id === reminder.slotId);
  const name = slot ? slotName(t, slot) : '';
  // A renamed built-in slot uses its new name, like a custom one.
  const body =
    slot && slot.name === null && BUILTIN_LINES.has(slot.id)
      ? t(`reminders.meal.${slot.id as 'lunch'}`)
      : t('reminders.meal.custom', { meal: name });
  return { title: name, body, data };
}

/** Which slots have an entry on each day from `from` for `days` days. */
async function loggedSlots(from: string, days: number): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  for (const entry of await listEntriesBetween(from, addDays(from, days - 1))) {
    const set = result.get(entry.day) ?? new Set<string>();
    set.add(entry.slotId);
    result.set(entry.day, set);
  }
  return result;
}

/** Replaces the scheduled reminders with the plan for the next 7 days. */
export async function syncReminders(
  t: TFunction,
  state: { reminders: ReminderSettings; slots: readonly MealSlot[]; hasPendingScans: boolean },
  now = Date.now(),
): Promise<void> {
  let plan: PlannedReminder[] = [];
  if (remindersOn(state.reminders, state.slots) > 0 && (await notificationsAllowed())) {
    plan = planReminders({
      now,
      settings: state.reminders,
      slots: state.slots,
      loggedSlots: await loggedSlots(logicalDay(now), PLAN_DAYS),
      hasPendingScans: state.hasPendingScans,
    });
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (plan.length === 0) return;

  await ensureChannel('reminders', t('reminders.channelName'));
  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${reminder.key}`,
      content: content(t, reminder, state.slots),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.at,
        channelId: 'reminders',
      },
    });
  }
}
