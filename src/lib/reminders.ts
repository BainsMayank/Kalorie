// Reminders (SPEC §5.12): optional local notifications, all off by default. A meal-time nudge per
// meal slot ("Had lunch? Tap to add it — takes 10 seconds."), skipped when that meal is already
// logged that day, and a quiet evening nudge when scanned packets are still waiting to be finished.
//
// The phone can't check the log at the moment a notification is due, so the app plans the next
// 7 days every time something changes (an entry, a setting, the scan queue, the app opening) and
// replaces what was scheduled. A meal logged today drops today's reminder for it.

import { addDays, logicalDay, timeOnDay, visibleSlots, type SlotWindow } from './day';

/** One reminder's switch and time (clock minutes). */
export interface ReminderSetting {
  on: boolean;
  minute: number;
}

/** Everything about reminders the person chose (settings key `reminders`). */
export interface ReminderSettings {
  /** By meal slot id; a slot with no entry uses its default time, switched off. */
  meals: Record<string, ReminderSetting>;
  /** The evening nudge for scans still waiting (SPEC §2.8 pending lookups). */
  pendingScans: ReminderSetting;
}

/** Never more than this many reminders in a day (SPEC §5.12). */
export const MAX_REMINDERS_A_DAY = 3;
/** How many days ahead reminders are scheduled. */
export const PLAN_DAYS = 7;

/** Default times: breakfast 9:00, lunch 13:30, snacks 17:00, dinner 20:30 (SPEC §5.12). */
export const DEFAULT_MEAL_MINUTES: Readonly<Record<string, number>> = {
  breakfast: 9 * 60,
  lunch: 13 * 60 + 30,
  snacks: 17 * 60,
  dinner: 20 * 60 + 30,
};
/** The meals switched on by "Remind me at meal times" during onboarding. */
export const ONBOARDING_MEALS = ['breakfast', 'lunch', 'dinner'] as const;
/** The pending scans nudge: 9 pm. */
export const DEFAULT_SCANS_MINUTE = 21 * 60;

export const REMINDERS_OFF: ReminderSettings = {
  meals: {},
  pendingScans: { on: false, minute: DEFAULT_SCANS_MINUTE },
};

/** A custom slot's default time: an hour after its window opens. */
function defaultMinute(slot: Pick<SlotWindow, 'id' | 'startMin'>): number {
  return DEFAULT_MEAL_MINUTES[slot.id] ?? (slot.startMin + 60) % (24 * 60);
}

/** A slot's reminder: what was saved, or its default time switched off. */
export function mealReminder(
  settings: ReminderSettings,
  slot: Pick<SlotWindow, 'id' | 'startMin'>,
): ReminderSetting {
  return settings.meals[slot.id] ?? { on: false, minute: defaultMinute(slot) };
}

/** How many reminders are switched on (visible slots only, plus the scans nudge). */
export function remindersOn(settings: ReminderSettings, slots: readonly SlotWindow[]): number {
  const meals = visibleSlots(slots).filter((s) => mealReminder(settings, s).on).length;
  return meals + (settings.pendingScans.on ? 1 : 0);
}

/** Turns on the onboarding meals (breakfast, lunch, dinner) at their default times. */
export function withOnboardingMeals(settings: ReminderSettings): ReminderSettings {
  const meals = { ...settings.meals };
  for (const id of ONBOARDING_MEALS) meals[id] = { on: true, minute: DEFAULT_MEAL_MINUTES[id] };
  return { ...settings, meals };
}

// --- Stored as JSON: {"meals":{"lunch":{"on":true,"at":"13:30"}},"pendingScans":{…}} ---------

function toClock(minute: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

function fromClock(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [h, m] = [Number(match[1]), Number(match[2])];
  return h < 24 && m < 60 ? h * 60 + m : null;
}

function parseOne(value: unknown): ReminderSetting | null {
  if (typeof value !== 'object' || value === null) return null;
  const { on, at } = value as { on?: unknown; at?: unknown };
  const minute = fromClock(at);
  return minute === null ? null : { on: on === true, minute };
}

/** Reads the saved setting; anything unreadable counts as off (the SPEC default). */
export function parseReminders(value: unknown): ReminderSettings {
  if (typeof value !== 'object' || value === null) return REMINDERS_OFF;
  const { meals, pendingScans } = value as { meals?: unknown; pendingScans?: unknown };
  const result: ReminderSettings = {
    meals: {},
    pendingScans: parseOne(pendingScans) ?? REMINDERS_OFF.pendingScans,
  };
  if (typeof meals === 'object' && meals !== null) {
    for (const [id, one] of Object.entries(meals)) {
      const parsed = parseOne(one);
      if (parsed) result.meals[id] = parsed;
    }
  }
  return result;
}

/** The JSON saved in `settings` (times as "HH:MM", like SPEC §4.2). */
export function serializeReminders(settings: ReminderSettings) {
  const one = ({ on, minute }: ReminderSetting) => ({ on, at: toClock(minute) });
  return {
    meals: Object.fromEntries(Object.entries(settings.meals).map(([id, r]) => [id, one(r)])),
    pendingScans: one(settings.pendingScans),
  };
}

// --- Planning --------------------------------------------------------------------------------

/** One notification to schedule. */
export interface PlannedReminder {
  /** Stable id, so a plan can replace the last one: "meal:lunch:2026-09-28". */
  key: string;
  kind: 'meal' | 'pendingScans';
  /** The meal slot, for meal reminders. */
  slotId: string | null;
  /** The logical day it's for. */
  day: string;
  /** When it goes off (epoch ms). */
  at: number;
}

/**
 * The reminders for the next `days` days from `now`, earliest first:
 * - a meal reminder for each visible slot switched on, unless that slot already has an entry on
 *   that day, or its time has passed;
 * - the pending scans nudge only while scans are waiting, and only at its next time (once, not
 *   every evening of the week: opening the app plans it again if they still wait);
 * - at most 3 a day, the earliest ones kept.
 */
export function planReminders(input: {
  now: number;
  settings: ReminderSettings;
  slots: readonly SlotWindow[];
  /** Slots with at least one entry, by day. */
  loggedSlots: ReadonlyMap<string, ReadonlySet<string>>;
  hasPendingScans: boolean;
  days?: number;
}): PlannedReminder[] {
  const { now, settings, loggedSlots } = input;
  const today = logicalDay(now);
  const slots = visibleSlots(input.slots);
  const plan: PlannedReminder[] = [];
  let scansPlanned = false;

  for (let i = 0; i < (input.days ?? PLAN_DAYS); i++) {
    const day = addDays(today, i);
    const todays: PlannedReminder[] = [];
    for (const slot of slots) {
      const reminder = mealReminder(settings, slot);
      if (!reminder.on || loggedSlots.get(day)?.has(slot.id)) continue;
      const at = timeOnDay(day, reminder.minute);
      if (at > now)
        todays.push({ key: `meal:${slot.id}:${day}`, kind: 'meal', slotId: slot.id, day, at });
    }
    if (settings.pendingScans.on && input.hasPendingScans && !scansPlanned) {
      const at = timeOnDay(day, settings.pendingScans.minute);
      if (at > now)
        todays.push({ key: `scans:${day}`, kind: 'pendingScans', slotId: null, day, at });
    }
    const kept = todays.sort((a, b) => a.at - b.at).slice(0, MAX_REMINDERS_A_DAY);
    scansPlanned ||= kept.some((r) => r.kind === 'pendingScans');
    plan.push(...kept);
  }
  return plan;
}
