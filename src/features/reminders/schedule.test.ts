import i18n from '@/i18n';

import * as Notifications from 'expo-notifications';

import { insertEntry } from '@/db/user/entries';
import type { MealSlot } from '@/db/user/schema';
import { listMealSlots, seedMealSlots } from '@/db/user/slots';
import { notificationsAllowed } from '@/features/alerts/notifications';
import { REMINDERS_OFF, type ReminderSettings } from '@/lib/reminders';

import { syncReminders } from './schedule';

jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getAllScheduledNotificationsAsync: jest.fn(async () => [
    { identifier: 'reminder:meal:lunch:2026-09-27' }, // from an older plan
    { identifier: 'something-else' },
  ]),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
}));
jest.mock('@/features/alerts/notifications', () => ({
  ensureChannel: jest.fn(async () => {}),
  notificationsAllowed: jest.fn(async () => true),
}));

const t = i18n.t.bind(i18n);
const now = new Date(2026, 8, 28, 12).getTime(); // Monday noon
let slots: MealSlot[];
const LUNCH_AND_DINNER: ReminderSettings = {
  meals: { lunch: { on: true, minute: 13 * 60 + 30 }, dinner: { on: true, minute: 20 * 60 + 30 } },
  pendingScans: { on: false, minute: 21 * 60 },
};

beforeAll(async () => {
  await seedMealSlots();
  slots = await listMealSlots();
  // Lunch is already logged today.
  await insertEntry({
    day: '2026-09-28',
    loggedAt: new Date(2026, 8, 28, 11).getTime(),
    slotId: 'lunch',
    foodSource: 'quick',
    foodId: null,
    name: '',
    qty: null,
    unit: null,
    grams: null,
    quickKcal: 500,
  });
});
beforeEach(() => jest.clearAllMocks());

const scheduled = () =>
  jest.mocked(Notifications.scheduleNotificationAsync).mock.calls.map(([request]) => request);

describe('syncReminders', () => {
  it("replaces Kalorie's old reminders with the new plan, leaving other notifications alone", async () => {
    await syncReminders(t, { reminders: LUNCH_AND_DINNER, slots, hasPendingScans: false }, now);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'reminder:meal:lunch:2026-09-27',
    );
    const ids = scheduled().map((r) => r.identifier);
    // Today's lunch is logged, so only today's dinner, then both meals for 6 more days.
    expect(ids[0]).toBe('reminder:meal:dinner:2026-09-28');
    expect(ids).not.toContain('reminder:meal:lunch:2026-09-28');
    expect(ids).toHaveLength(1 + 2 * 6);
  });

  it('uses the SPEC wording and remembers which meal to open', async () => {
    await syncReminders(t, { reminders: LUNCH_AND_DINNER, slots, hasPendingScans: false }, now);
    const [first] = scheduled();
    expect(first.content).toEqual({
      title: 'Dinner',
      body: 'Had dinner? Tap to add it — takes 10 seconds.',
      data: { kind: 'reminder', slotId: 'dinner' },
    });
    expect(first.trigger).toEqual({
      type: 'date',
      date: new Date(2026, 8, 28, 20, 30).getTime(),
      channelId: 'reminders',
    });
  });

  it('adds the evening nudge while scans are waiting', async () => {
    const reminders = { ...REMINDERS_OFF, pendingScans: { on: true, minute: 21 * 60 } };
    await syncReminders(t, { reminders, slots, hasPendingScans: true }, now);
    expect(scheduled()).toEqual([
      expect.objectContaining({
        identifier: 'reminder:scans:2026-09-28',
        content: expect.objectContaining({ title: 'Scanned packets waiting' }),
      }),
    ]);
  });

  it('only cancels when reminders are off or notifications are not allowed', async () => {
    await syncReminders(t, { reminders: REMINDERS_OFF, slots, hasPendingScans: true }, now);
    jest.mocked(notificationsAllowed).mockResolvedValueOnce(false);
    await syncReminders(t, { reminders: LUNCH_AND_DINNER, slots, hasPendingScans: false }, now);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
